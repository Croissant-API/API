import { Request, Response } from "express";
import { controller, httpPost } from "inversify-express-utils";
import Stripe from "stripe";
import { sendError } from "../utils/helpers";

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_API_KEY = process.env.STRIPE_API_KEY; // Set your Stripe secret key in env

@controller("/stripe")
export class StripeController {
    private stripe: Stripe;
    constructor() {
        if(!STRIPE_API_KEY) {
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
                req.body,
                sig,
                STRIPE_WEBHOOK_SECRET
            );
        } catch (err) {
            return sendError(res, 400, `Webhook Error: ${(err as Error).message}`);
        }

        // Handle the event
        switch (event.type) {
            case "payment_intent.succeeded": {
                const paymentIntent = event.data.object as Stripe.PaymentIntent;
                console.log("PaymentIntent was successful!", paymentIntent);
                // TODO: handle successful payment
                break;
            }
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                console.log("Checkout session completed:", session);
                // TODO: handle checkout session completed
                break;
            }
            // Add more event types as needed
            default:
                // Unexpected event type
                break;
        }
        res.status(200).send({ received: true });
    }
}
