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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Inventories = void 0;
const inversify_1 = require("inversify");
const inversify_express_utils_1 = require("inversify-express-utils");
const InventoryValidator_1 = require("../validators/InventoryValidator");
const describe_1 = require("../decorators/describe");
const LoggedCheck_1 = require("../middlewares/LoggedCheck");
const helpers_1 = require("../utils/helpers");
// --- UTILS ---
const yup_1 = require("yup");
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
let Inventories = class Inventories {
    constructor(inventoryService, itemService) {
        this.inventoryService = inventoryService;
        this.itemService = itemService;
    }
    // --- Inventaire de l'utilisateur courant ---
    async getMyInventory(req, res) {
        const userId = req.user.user_id; // Assuming you have middleware that sets req.userId
        try {
            const { inventory } = await this.inventoryService.getInventory(userId);
            res.send(await (0, helpers_1.formatInventory)(inventory, this.itemService));
        }
        catch (error) {
            handleError(res, error, "Error fetching inventory");
        }
    }
    // --- Inventaire d'un utilisateur spécifique ---
    async getInventory(req, res) {
        if (!(await validateOr400(InventoryValidator_1.userIdParamSchema, { userId: req.params.userId }, res)))
            return;
        const userId = req.params.userId;
        try {
            const { inventory } = await this.inventoryService.getInventory(userId);
            res.send(await (0, helpers_1.formatInventory)(inventory, this.itemService));
        }
        catch (error) {
            handleError(res, error, "Error fetching inventory");
        }
    }
    // --- Route générique (prompt) ---
    async getAllInventories(req, res) {
        res.send({ message: "Please specify /api/inventory/<userId>" });
    }
};
__decorate([
    (0, describe_1.describe)({
        endpoint: "/inventory/",
        method: "GET",
        description: "Prompt to specify a userId for inventory lookup",
        responseType: [
            {
                itemId: "string",
                name: "string",
                description: "string",
                amount: "number",
            },
        ],
        example: "GET /api/inventory/",
    }),
    (0, inversify_express_utils_1.httpGet)("/@me", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Inventories.prototype, "getMyInventory", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/inventory/:userId",
        method: "GET",
        description: "Get the inventory of a user",
        params: { userId: "The id of the user" },
        responseType: [
            {
                itemId: "string",
                name: "string",
                description: "string",
                amount: "number",
            },
        ],
        example: "GET /api/inventory/123",
    }),
    (0, inversify_express_utils_1.httpGet)("/:userId"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Inventories.prototype, "getInventory", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)("/"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Inventories.prototype, "getAllInventories", null);
Inventories = __decorate([
    (0, inversify_express_utils_1.controller)("/inventory"),
    __param(0, (0, inversify_1.inject)("InventoryService")),
    __param(1, (0, inversify_1.inject)("ItemService")),
    __metadata("design:paramtypes", [Object, Object])
], Inventories);
exports.Inventories = Inventories;
