"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeController = void 0;
const inversify_express_utils_1 = require("inversify-express-utils");
const stripe_1 = __importDefault(require("stripe"));
const helpers_1 = require("../utils/helpers");
const LoggedCheck_1 = require("../middlewares/LoggedCheck");
const inversify_1 = require("inversify");
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_API_KEY = process.env.STRIPE_API_KEY; // Set your Stripe secret key in env
let StripeController = class StripeController {
    constructor(userService // Assuming you have a UserService to handle user-related operations
    ) {
        this.userService = userService;
        if (!STRIPE_API_KEY) {
            throw new Error("Stripe API key is not set in environment variables");
        }
        // Initialize Stripe with the API key and version
        this.stripe = new stripe_1.default(STRIPE_API_KEY, { apiVersion: "2025-06-30.basil" });
    }
    /**
     * Stripe webhook endpoint
     * Handles all incoming Stripe webhook events
     */
    async handleWebhook(req, res) {
        if (!STRIPE_WEBHOOK_SECRET) {
            return (0, helpers_1.sendError)(res, 500, "Stripe webhook secret is not set in environment variables");
        }
        const sig = req.headers["stripe-signature"];
        let event;
        try {
            event = this.stripe.webhooks.constructEvent(req.body, // This is a Buffer, as required by Stripe
            sig, STRIPE_WEBHOOK_SECRET);
        }
        catch (err) {
            return (0, helpers_1.sendError)(res, 400, `Webhook Error: ${err.message}`);
        }
        // Handle the event
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object;
                if (!session.metadata || !session.metadata.user_id || !session.metadata.credits) {
                    return (0, helpers_1.sendError)(res, 400, "Invalid session metadata");
                }
                console.log("Checkout session completed:", session);
                const user = await this.userService.getUser(session.metadata.user_id);
                if (!user) {
                    return (0, helpers_1.sendError)(res, 404, "User not found");
                }
                await this.userService.updateUserBalance(user.user_id, user.balance + parseInt(session.metadata.credits));
                // TODO: handle checkout session completed
                break;
            }
        }
        res.status(200).send({ received: true });
    }
    async checkoutEndpoint(req, res) {
        const tier = req.query.tier;
        const tiers = [
            {
                id: "tier1",
                price: 99,
                credits: 200,
                name: "200 credits",
                image: "https://croissant-api.fr/assets/credits/tier1.png"
            },
            {
                id: "tier2",
                price: 199,
                credits: 400,
                name: "400 credits",
                image: "https://croissant-api.fr/assets/credits/tier2.png"
            },
            {
                id: "tier3",
                price: 499,
                credits: 1000,
                name: "1000 credits",
                image: "https://croissant-api.fr/assets/credits/tier3.png"
            },
            {
                id: "tier4",
                price: 999,
                credits: 2000,
                name: "2000 credits",
                image: "https://croissant-api.fr/assets/credits/tier4.png"
            }
        ];
        const selectedTier = tiers.find(t => t.id === tier);
        if (!selectedTier) {
            return (0, helpers_1.sendError)(res, 400, "Invalid tier selected");
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
        }
        else {
            res.status(500).send({ error: "Stripe session URL is null." });
        }
    }
};
__decorate([
    (0, inversify_express_utils_1.httpPost)("/webhook"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StripeController.prototype, "handleWebhook", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)("/checkout", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StripeController.prototype, "checkoutEndpoint", null);
StripeController = __decorate([
    (0, inversify_express_utils_1.controller)("/stripe"),
    __param(0, (0, inversify_1.inject)("UserService")),
    __metadata("design:paramtypes", [Object])
], StripeController);
exports.StripeController = StripeController;
