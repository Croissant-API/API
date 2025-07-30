"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
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
const inversify_1 = require("inversify");
const LoggedCheck_1 = require("../middlewares/LoggedCheck");
const yup_1 = require("yup");
const yup = __importStar(require("yup"));
// --- CONSTANTS ---
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_API_KEY = process.env.STRIPE_API_KEY;
// Configuration des tiers de crédits
const CREDIT_TIERS = [
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
// --- VALIDATORS ---
const checkoutQuerySchema = yup.object({
    tier: yup.string().oneOf(CREDIT_TIERS.map(t => t.id)).required()
});
// --- UTILS ---
function handleError(res, error, message, status = 500) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(status).send({ message, error: msg });
}
async function validateOr400(schema, data, res) {
    try {
        await schema.validate(data);
        return true;
    }
    catch (error) {
        if (error instanceof yup_1.ValidationError) {
            res.status(400).send({
                message: "Validation failed",
                errors: error.errors,
            });
            return false;
        }
        throw error;
    }
}
let StripeController = class StripeController {
    constructor(userService, logService) {
        this.userService = userService;
        this.logService = logService;
        if (!STRIPE_API_KEY) {
            throw new Error("Stripe API key is not set in environment variables");
        }
        this.stripe = new stripe_1.default(STRIPE_API_KEY, {
            apiVersion: "2025-06-30.basil"
        });
    }
    // Helper pour les logs
    async logAction(req, tableName, statusCode, metadata) {
        try {
            const requestBody = { ...req.body };
            // Ajouter les métadonnées si fournies
            if (metadata) {
                requestBody.metadata = metadata;
            }
            await this.logService.createLog({
                ip_address: req.headers["x-real-ip"] || req.socket.remoteAddress,
                table_name: tableName,
                controller: 'StripeController',
                original_path: req.originalUrl,
                http_method: req.method,
                request_body: requestBody,
                user_id: req.user?.user_id,
                status_code: statusCode
            });
        }
        catch (error) {
            console.error('Failed to log action:', error);
        }
    }
    async handleWebhook(req, res) {
        if (!STRIPE_WEBHOOK_SECRET) {
            await this.logAction(req, 'stripe_webhooks', 500);
            return handleError(res, new Error("Webhook secret not configured"), "Stripe webhook secret is not set", 500);
        }
        const sig = req.headers["stripe-signature"];
        if (!sig) {
            await this.logAction(req, 'stripe_webhooks', 400);
            return handleError(res, new Error("Missing signature"), "Missing Stripe signature", 400);
        }
        let event;
        try {
            event = this.stripe.webhooks.constructEvent(req.body, // Buffer as required by Stripe
            sig, STRIPE_WEBHOOK_SECRET);
        }
        catch (err) {
            await this.logAction(req, 'stripe_webhooks', 400, { error: 'signature_verification_failed' });
            return handleError(res, err, "Webhook signature verification failed", 400);
        }
        try {
            await this.processWebhookEvent(event);
            await this.logAction(req, 'stripe_webhooks', 200, {
                event_type: event.type,
                event_id: event.id
            });
            res.status(200).send({ received: true });
        }
        catch (error) {
            await this.logAction(req, 'stripe_webhooks', 500, {
                event_type: event.type,
                event_id: event.id,
                error: error instanceof Error ? error.message : String(error)
            });
            handleError(res, error, "Error processing webhook event");
        }
    }
    // --- CHECKOUT ---
    async checkoutEndpoint(req, res) {
        if (!(await validateOr400(checkoutQuerySchema, req.query, res))) {
            await this.logAction(req, 'stripe_sessions', 400);
            return;
        }
        try {
            const { tier } = req.query;
            const selectedTier = CREDIT_TIERS.find(t => t.id === tier);
            if (!selectedTier) {
                await this.logAction(req, 'stripe_sessions', 400, { tier, reason: 'invalid_tier' });
                return res.status(400).send({
                    message: "Invalid tier selected",
                    availableTiers: CREDIT_TIERS.map(t => t.id)
                });
            }
            const session = await this.createCheckoutSession(selectedTier, req.user.user_id);
            if (!session.url) {
                await this.logAction(req, 'stripe_sessions', 500, {
                    tier: selectedTier.id,
                    reason: 'no_session_url'
                });
                return res.status(500).send({
                    message: "Failed to create checkout session",
                    error: "Stripe session URL is null"
                });
            }
            await this.logAction(req, 'stripe_sessions', 200, {
                tier: selectedTier.id,
                credits: selectedTier.credits,
                price: selectedTier.price,
                session_id: session.id
            });
            res.send({ url: session.url });
        }
        catch (error) {
            await this.logAction(req, 'stripe_sessions', 500, {
                error: error instanceof Error ? error.message : String(error)
            });
            handleError(res, error, "Error creating checkout session");
        }
    }
    async getTiers(req, res) {
        await this.logAction(req, undefined, 200);
        res.send(CREDIT_TIERS);
    }
    // --- PRIVATE METHODS ---
    async processWebhookEvent(event) {
        switch (event.type) {
            case "checkout.session.completed":
                await this.handleCheckoutCompleted(event.data.object);
                break;
            case "payment_intent.succeeded":
                console.log("Payment succeeded:", event.data.object);
                break;
            case "payment_intent.payment_failed":
                console.log("Payment failed:", event.data.object);
                break;
            default:
                console.log(`Unhandled event type: ${event.type}`);
        }
    }
    async handleCheckoutCompleted(session) {
        const { metadata } = session;
        if (!metadata?.user_id || !metadata?.credits) {
            throw new Error("Invalid session metadata: missing user_id or credits");
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
        // Log du succès du paiement et de l'ajout de crédits
        console.log(`Added ${creditsToAdd} credits to user ${user.user_id} (${user.username})`);
        console.log(`Balance updated: ${oldBalance} -> ${oldBalance + creditsToAdd}`);
    }
    async createCheckoutSession(tier, userId) {
        return await this.stripe.checkout.sessions.create({
            payment_method_types: ['card', 'link', 'paypal'],
            payment_method_options: {
                card: {
                // Google Pay is supported automatically via card
                },
                link: {
                // Link payment method for saved payment methods
                }
            },
            line_items: [{
                    quantity: 1,
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: tier.name,
                            images: [tier.image],
                            description: `Add ${tier.credits} credits to your Croissant account`
                        },
                        unit_amount: tier.price,
                    },
                }],
            mode: 'payment',
            metadata: {
                credits: tier.credits.toString(),
                user_id: userId,
                tier_id: tier.id
            },
            success_url: `${process.env.FRONTEND_URL || 'https://croissant-api.fr'}/buy-credits/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL || 'https://croissant-api.fr'}/buy-credits`,
            automatic_tax: { enabled: true },
            billing_address_collection: 'auto',
            customer_creation: 'if_required'
        });
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
__decorate([
    (0, inversify_express_utils_1.httpGet)("/tiers"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StripeController.prototype, "getTiers", null);
StripeController = __decorate([
    (0, inversify_express_utils_1.controller)("/stripe"),
    __param(0, (0, inversify_1.inject)("UserService")),
    __param(1, (0, inversify_1.inject)("LogService")),
    __metadata("design:paramtypes", [Object, Object])
], StripeController);
exports.StripeController = StripeController;
