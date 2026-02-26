/* eslint-disable @typescript-eslint/no-explicit-any */
import { Context } from 'hono';
import { controller, httpGet } from 'hono-inversify';
import { inject, injectable } from 'inversify';
import { LoggedCheck } from 'middlewares/LoggedCheck';
import Stripe from 'stripe';
import * as yup from 'yup';
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

function sendError(c: Context, status: number, message: string, error?: unknown) {
  return c.json({ message, error: error instanceof Error ? error.message : error }, status as any);
}

@injectable()
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

  private async createLog(c: Context, action: string, tableName?: string, statusCode?: number, userId?: string, metadata?: object, body?: any) {
    try {
      let requestBody: any = body || { note: 'Body not provided for logging' };
      if (metadata) requestBody = { ...requestBody, metadata };
      const clientIP = c.req.header('cf-connecting-ip') ||
        c.req.header('x-forwarded-for') ||
        c.req.header('x-real-ip') ||
        'unknown';
      await this.logService.createLog({
        ip_address: clientIP,
        table_name: tableName,
        controller: `StripeController.${action}`,
        original_path: c.req.path,
        http_method: c.req.method,
        request_body: JSON.stringify(requestBody),
        user_id: userId,
        status_code: statusCode,
      });
    } catch (error) {
      console.error('Error creating log:', error);
    }
  }

  async getTiers(c: Context) {
    await this.createLog(c, 'getTiers', undefined, 200);
    return c.json(CREDIT_TIERS, 200);
  }

  @httpGet('/checkout', LoggedCheck)
  async checkout(c: Context) {
    try {
      const query = c.req.query();
      try {
        await checkoutQuerySchema.validate(query);
      } catch (error) {
        await this.createLog(c, 'checkout', 'stripe_sessions', 400, undefined, undefined, query);
        return sendError(c, 400, 'Validation failed', error);
      }

      const user = c.get('user');
      if (!user) {
        await this.createLog(c, 'checkout', 'stripe_sessions', 401);
        return sendError(c, 401, 'Unauthorized');
      }

      const selectedTier = CREDIT_TIERS.find(t => t.id === query.tier);
      if (!selectedTier) {
        await this.createLog(c, 'checkout', 'stripe_sessions', 400, user.user_id, { tier: query.tier, reason: 'invalid_tier' }, query);
        return sendError(c, 400, 'Invalid tier selected');
      }

      const session = await this.createCheckoutSession(selectedTier, user.user_id);
      if (!session.url) {
        await this.createLog(c, 'checkout', 'stripe_sessions', 500, user.user_id, { tier: selectedTier.id, reason: 'no_session_url' }, query);
        return sendError(c, 500, 'Failed to create checkout session');
      }

      await this.createLog(c, 'checkout', 'stripe_sessions', 200, user.user_id, {
        tier: selectedTier.id,
        credits: selectedTier.credits,
        price: selectedTier.price,
        session_id: session.id,
      }, query);

      return c.json({ url: session.url }, 200);
    } catch (error) {
      const user = c.get('user');
      await this.createLog(c, 'checkout', 'stripe_sessions', 500, user?.user_id, { error: error instanceof Error ? error.message : String(error) });
      return sendError(c, 500, 'Error creating checkout session', error);
    }
  }

  async webhook(c: Context) {
    try {
      if (!STRIPE_WEBHOOK_SECRET) {
        await this.createLog(c, 'webhook', 'stripe_webhooks', 500);
        return sendError(c, 500, 'Stripe webhook secret is not set');
      }

      const sig = c.req.header('stripe-signature');
      if (!sig) {
        await this.createLog(c, 'webhook', 'stripe_webhooks', 400);
        return sendError(c, 400, 'Missing Stripe signature');
      }

      let event: Stripe.Event;
      try {
        const body = await c.req.text();
        event = this.stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        await this.createLog(c, 'webhook', 'stripe_webhooks', 400, undefined, { error: 'signature_verification_failed' });
        return sendError(c, 400, 'Webhook signature verification failed', err);
      }

      try {
        await this.processWebhookEvent(event);
        await this.createLog(c, 'webhook', 'stripe_webhooks', 200, undefined, {
          event_type: event.type,
          event_id: event.id,
        });
        return c.json({ received: true }, 200);
      } catch (error) {
        await this.createLog(c, 'webhook', 'stripe_webhooks', 500, undefined, {
          event_type: event.type,
          event_id: event.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return sendError(c, 500, 'Error processing webhook event', error);
      }
    } catch (error) {
      await this.createLog(c, 'webhook', 'stripe_webhooks', 500);
      return sendError(c, 500, 'Internal server error', error);
    }
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
    await this.userService.updateUserBalance(user.user_id, user.balance + creditsToAdd);
    console.log(`Added ${creditsToAdd} credits to user ${user.user_id} (${user.username})`);
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
