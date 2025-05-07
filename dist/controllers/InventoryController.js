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
import { inject } from 'inversify';
import { controller, httpGet } from "inversify-express-utils";
import { userIdParamSchema } from '../validators/InventoryValidator';
import { describe } from '../decorators/describe';
import { LoggedCheck } from '../middlewares/LoggedCheck';
let Inventories = class Inventories {
    constructor(inventoryService, itemService) {
        this.inventoryService = inventoryService;
        this.itemService = itemService;
    }
    async getAllInventories(req, res) {
        res.send({ message: "Please specify /api/inventory/<userId>" });
    }
    async getMyInventory(req, res) {
        const userId = req.user.user_id; // Assuming you have middleware that sets req.userId
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
                    iconHash: itemDetails.iconHash
                };
            }))).filter(Boolean); // Remove nulls
            res.send(filteredInventory);
        }
        catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error fetching inventory", error: message });
        }
    }
    async getInventory(req, res) {
        try {
            await userIdParamSchema.validate({ userId: req.params.userId });
        }
        catch (err) {
            return res.status(400).send({ message: err instanceof Error ? err.message : String(err) });
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
                    iconHash: itemDetails.iconHash
                };
            }))).filter(Boolean); // Remove nulls
            res.send(filteredInventory);
        }
        catch (error) {
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error fetching inventory", error: message });
        }
    }
};
__decorate([
    httpGet("/"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Inventories.prototype, "getAllInventories", null);
__decorate([
    describe({
        endpoint: "/inventory/",
        method: "GET",
        description: "Prompt to specify a userId for inventory lookup",
        responseType: "object{message: string}",
        example: "GET /api/inventory/"
    }),
    httpGet("/@me", LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Inventories.prototype, "getMyInventory", null);
__decorate([
    describe({
        endpoint: "/inventory/:userId",
        method: "GET",
        description: "Get the inventory of a user",
        params: { userId: "The id of the user" },
        responseType: "array[object{itemId: string, name: string, description: string, amount: number}]",
        example: "GET /api/inventory/123"
    }),
    httpGet("/:userId"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Inventories.prototype, "getInventory", null);
Inventories = __decorate([
    controller("/inventory"),
    __param(0, inject("InventoryService")),
    __param(1, inject("ItemService")),
    __metadata("design:paramtypes", [Object, Object])
], Inventories);
export { Inventories };
