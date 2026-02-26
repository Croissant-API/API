import { Request, Response } from 'express';
import { inject } from 'inversify';
import { controller, httpGet, httpPost } from 'inversify-express-utils';
import Stripe from 'stripe';
import * as yup from 'yup';
import { Schema, ValidationError } from 'yup';
import { AuthenticatedRequest, LoggedCheck } from '../middlewares/LoggedCheck';
import { ILogService } from '../services/LogService';
import { IUserService } from '../services/UserService';

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_API_KEY = process.env.STRIPE_API_KEY;

const CREDIT_TIERS = [
  {
    id: 'tier1',
    price: 99,
    credits: 200,
    name: '200 credits',
    image: 'https://croissant-api.fr/assets/credits/tier1.png',
  },
  {
    id: 'tier2',
    price: 198,
    credits: 400,
    name: '400 credits',
    image: 'https://croissant-api.fr/assets/credits/tier2.png',
  },
  {
    id: 'tier3',
    price: 495,
    credits: 1000,
    name: '1000 credits',
    image: 'https://croissant-api.fr/assets/credits/tier3.png',
  },
  {
    id: 'tier4',
    price: 990,
    credits: 2000,
    name: '2000 credits',
    image: 'https://croissant-api.fr/assets/credits/tier4.png',
  },
] as const;

const checkoutQuerySchema = yup.object({
  tier: yup
    .string()
    .oneOf(CREDIT_TIERS.map(t => t.id))
    .required(),
});

function handleError(res: Response, error: unknown, message: string, status = 500) {
  const msg = error instanceof Error ? error.message : String(error);
  res.status(status).send({ message, error: msg });
}

async function validateOr400(schema: Schema<unknown>, data: unknown, res: Response) {
  try {
    await schema.validate(data);
    return true;
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).send({
        message: 'Validation failed',
        errors: error.errors,
      });
      return false;
    }
    throw error;
  }
}

@controller('/stripe')
export class StripeController {
  private stripe: Stripe;

  constructor(
    @inject('UserService') private userService: IUserService,
    @inject('LogService') private logService: ILogService
  ) {
    if (!STRIPE_API_KEY) {
      throw new Error('Stripe API key is not set in environment variables');
    }
    this.stripe = new Stripe(STRIPE_API_KEY, {
      apiVersion: '2025-08-27.basil',
    });
  }

  private async createLog(req: Request, tableName?: string, statusCode?: number, metadata?: object, user_id?: string) {
    try {
      const requestBody = { ...req.body };
      if (metadata) requestBody.metadata = metadata;
      await this.logService.createLog({
        ip_address: (req.headers['x-real-ip'] as string) || (req.socket.remoteAddress as string),
        table_name: tableName,
        controller: 'StripeController',
        original_path: req.originalUrl,
        http_method: req.method,
        request_body: requestBody,
        status_code: statusCode,
        user_id: user_id,
      });
    } catch (error) {
      console.error('Failed to log action:', error);
    }
  }

  @httpPost('/webhook')
  public async handleWebhook(req: Request, res: Response) {
    if (!STRIPE_WEBHOOK_SECRET) {
      await this.createLog(req, 'stripe_webhooks', 500);
      return handleError(res, new Error('Webhook secret not configured'), 'Stripe webhook secret is not set', 500);
    }

    const sig = req.headers['stripe-signature'] as string;
    if (!sig) {
      await this.createLog(req, 'stripe_webhooks', 400);
      return handleError(res, new Error('Missing signature'), 'Missing Stripe signature', 400);
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      await this.createLog(req, 'stripe_webhooks', 400, { error: 'signature_verification_failed' });
      return handleError(res, err, 'Webhook signature verification failed', 400);
    }

    try {
      await this.processWebhookEvent(event);
      await this.createLog(req, 'stripe_webhooks', 200, {
        event_type: event.type,
        event_id: event.id,
      });
      res.status(200).send({ received: true });
    } catch (error) {
      await this.createLog(req, 'stripe_webhooks', 500, {
        event_type: event.type,
        event_id: event.id,
        error: error instanceof Error ? error.message : String(error),
      });
      handleError(res, error, 'Error processing webhook event');
    }
  }

  @httpGet('/checkout', LoggedCheck.middleware)
  public async checkoutEndpoint(req: AuthenticatedRequest, res: Response) {
    //res.send("This endpoint is temporarly disabled, please retry later")
    //return;

    if (!(await validateOr400(checkoutQuerySchema, req.query, res))) {
      await this.createLog(req, 'stripe_sessions', 400);
      return;
    }

    try {
      const { tier } = req.query as { tier: string };
      const selectedTier = CREDIT_TIERS.find(t => t.id === tier);

      if (!selectedTier) {
        await this.createLog(req, 'stripe_sessions', 400, { tier, reason: 'invalid_tier' }, req.user?.user_id);
        return res.status(400).send({
          message: 'Invalid tier selected',
          availableTiers: CREDIT_TIERS.map(t => t.id),
        });
      }

      const session = await this.createCheckoutSession(selectedTier, req.user.user_id);

      if (!session.url) {
        await this.createLog(req, 'stripe_sessions', 500, {
          tier: selectedTier.id,
          reason: 'no_session_url',
        });
        return res.status(500).send({
          message: 'Failed to create checkout session',
          error: 'Stripe session URL is null',
        });
      }

      await this.createLog(req, 'stripe_sessions', 200, {
        tier: selectedTier.id,
        credits: selectedTier.credits,
        price: selectedTier.price,
        session_id: session.id,
      });
      res.send({ url: session.url });
    } catch (error) {
      await this.createLog(req, 'stripe_sessions', 500, {
        error: error instanceof Error ? error.message : String(error),
      });
      handleError(res, error, 'Error creating checkout session');
    }
  }

  @httpGet('/tiers')
  public async getTiers(req: Request, res: Response) {
    await this.createLog(req, undefined, 200);
    res.send(CREDIT_TIERS);
  }

  private async processWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'payment_intent.succeeded':
        console.log('Payment succeeded:', event.data.object);
        break;
      case 'payment_intent.payment_failed':
        console.log('Payment failed:', event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const { metadata } = session;

    if (!metadata?.user_id || !metadata?.credits) {
      throw new Error('Invalid session metadata: missing user_id or credits');
    }

    const user = await this.userService.getUser(metadata.user_id);
    if (!user) {
      throw new Error(`User not found: ${metadata.user_id}`);
    }

    const creditsToAdd = parseInt(metadata.credits, 10);
    if (isNaN(creditsToAdd) || creditsToAdd <= 0) {
      throw new Error(`Invalid credits amount: ${metadata.credits}`);
    }

    const oldBalance = user.balance;
    await this.userService.updateUserBalance(user.user_id, user.balance + creditsToAdd);

    console.log(`Added ${creditsToAdd} credits to user ${user.user_id} (${user.username})`);
    console.log(`Balance updated: ${oldBalance} -> ${oldBalance + creditsToAdd}`);
  }

  private async createCheckoutSession(tier: (typeof CREDIT_TIERS)[number], userId: string): Promise<Stripe.Checkout.Session> {
    return await this.stripe.checkout.sessions.create({
      payment_method_types: ['card', 'link', 'paypal'],
      payment_method_options: {
        card: {},
        link: {},
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            product_data: {
              name: tier.name,
              images: [tier.image],
              description: `Add ${tier.credits} credits to your Croissant account`,
            },
            unit_amount: tier.price,
          },
        },
      ],
      mode: 'payment',
      metadata: {
        credits: tier.credits.toString(),
        user_id: userId,
        tier_id: tier.id,
      },
      success_url: `${process.env.FRONTEND_URL || 'https://croissant-api.fr'}/buy-credits/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'https://croissant-api.fr'}/buy-credits`,
      automatic_tax: { enabled: true },
      billing_address_collection: 'auto',
      customer_creation: 'if_required',
    });
  }
}
