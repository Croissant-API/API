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
            const seen = new Set();
            const uniqueInventory = inventory.filter((item) => {
                if (seen.has(item.item_id))
                    return false;
                seen.add(item.item_id);
                return true;
            });
            const filteredInventory = (await Promise.all(uniqueInventory.map(async (item) => {
                const itemDetails = await this.itemService.getItem(item.item_id);
                if (!itemDetails || itemDetails.deleted) {
                    return null; // Skip deleted items
                }
                return {
                    itemId: itemDetails.itemId,
                    name: itemDetails.name,
                    description: itemDetails.description,
                    amount: item.amount,
                    iconHash: itemDetails.iconHash,
                };
            }))).filter(Boolean); // Remove nulls
            res.send(filteredInventory);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            res
                .status(500)
                .send({ message: "Error fetching inventory", error: message });
        }
    }
    // --- Inventaire d'un utilisateur spécifique ---
    async getInventory(req, res) {
        try {
            await InventoryValidator_1.userIdParamSchema.validate({ userId: req.params.userId });
        }
        catch (err) {
            return res
                .status(400)
                .send({ message: err instanceof Error ? err.message : String(err) });
        }
        const userId = req.params.userId;
        try {
            const { inventory } = await this.inventoryService.getInventory(userId);
            const filteredInventory = (await Promise.all(inventory.map(async (item) => {
                const itemDetails = await this.itemService.getItem(item.item_id);
                if (!itemDetails || itemDetails.deleted) {
                    return null; // Skip deleted items
                }
                return {
                    itemId: itemDetails.itemId,
                    name: itemDetails.name,
                    description: itemDetails.description,
                    amount: item.amount,
                    iconHash: itemDetails.iconHash,
                };
            }))).filter(Boolean); // Remove nulls
            res.send(filteredInventory);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            res
                .status(500)
                .send({ message: "Error fetching inventory", error: message });
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
