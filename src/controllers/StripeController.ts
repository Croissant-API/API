import { Request, Response } from "express";
import { controller, httpGet, httpPost } from "inversify-express-utils";
import Stripe from "stripe";
import { sendError } from "../utils/helpers";
import { AuthenticatedRequest, LoggedCheck } from "../middlewares/LoggedCheck";
import { inject } from "inversify";
import { IUserService } from "../services/UserService";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_API_KEY = process.env.STRIPE_API_KEY; // Set your Stripe secret key in env

@controller("/stripe")
export class StripeController {
    private stripe: Stripe;
    constructor(
        @inject("UserService") private userService: IUserService // Assuming you have a UserService to handle user-related operations
    ) {
        if (!STRIPE_API_KEY) {
            throw new Error("Stripe API key is not set in environment variables");
        }
        // Initialize Stripe with the API key and version
        this.stripe = new Stripe(STRIPE_API_KEY, { apiVersion: "2025-06-30.basil" });
    }

    /**
     * Stripe webhook endpoint
     * Handles all incoming Stripe webhook events
     */
    @httpPost("/webhook")
    public async handleWebhook(req: Request, res: Response) {
        if (!STRIPE_WEBHOOK_SECRET) {
            return sendError(res, 500, "Stripe webhook secret is not set in environment variables");
        }
        const sig = req.headers["stripe-signature"] as string;
        let event: Stripe.Event;
        try {
            event = this.stripe.webhooks.constructEvent(
                req.body, // This is a Buffer, as required by Stripe
                sig,
                STRIPE_WEBHOOK_SECRET
            );
        } catch (err) {
            return sendError(res, 400, `Webhook Error: ${(err as Error).message}`);
        }

        // Handle the event
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                if(!session.metadata || !session.metadata.user_id || !session.metadata.credits) {
                    return sendError(res, 400, "Invalid session metadata");
                }
                console.log("Checkout session completed:", session);
                const user = await this.userService.getUser(session.metadata.user_id);
                if (!user) {
                    return sendError(res, 404, "User not found");
                }
                await this.userService.updateUserBalance(user.user_id, user.balance + parseInt(session.metadata.credits));
                // TODO: handle checkout session completed
                break;
            }
        }
        res.status(200).send({ received: true });
    }

    @httpGet("/checkout", LoggedCheck.middleware)
    public async checkoutEndpoint(req: AuthenticatedRequest, res: Response) {
        const tier = req.query.tier as string;
        const tiers = [
            {
                id: "tier1",
                price: 99, // 0.99€ in cents
                credits: 200,
                name: "200 credits",
                image: "https://croissant-api.fr/assets/credits/tier1.png"
            },
            {
                id: "tier2",
                price: 199, // 1.99€ in cents
                credits: 400,
                name: "400 credits",
                image: "https://croissant-api.fr/assets/credits/tier2.png"
            },
            {
                id: "tier3",
                price: 499, // 4.99€ in cents
                credits: 1000,
                name: "1000 credits",
                image: "https://croissant-api.fr/assets/credits/tier3.png"
            },
            {
                id: "tier4",
                price: 999, // 9.99€ in cents
                credits: 2000,
                name: "2000 credits",
                image: "https://croissant-api.fr/assets/credits/tier4.png"
            }
        ];
        const selectedTier = tiers.find(t => t.id === tier);
        if (!selectedTier) {
            return sendError(res, 400, "Invalid tier selected");
        }
        const session = await this.stripe.checkout.sessions.create({
            payment_method_types: ['card', 'link'],
            payment_method_options: {
                card: {
                    // Google Pay is supported automatically via card
                },
                link: {
                    // Link is a payment method that allows users to pay with saved payment methods
                },
                paypal: {
                    // PayPal is not supported in the EU yet, but can be added later
                }
            },
            line_items: [
                {
                    quantity: 1,
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: selectedTier.name,
                            images: [selectedTier.image],
                        },
                        unit_amount: selectedTier.price,
                    },
                },
            ],
            mode: 'payment',
            metadata: {
                credits: selectedTier.credits,
                user_id: req.user.user_id.toString() // Ensure user_id is a string
            },
            success_url: 'https://croissant-api.fr/buy-credits/success',
            cancel_url: 'https://croissant-api.fr/buy-credits',
        });

        const paymentLink = session.url;
        if (paymentLink) {
            res.send({ url: paymentLink });
        } else {
            res.status(500).send({ error: "Stripe session URL is null." });
        }
    }
}