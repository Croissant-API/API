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
exports.InventoryService = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
const inversify_1 = require("inversify");
const uuid_1 = require("uuid");
let InventoryService = class InventoryService {
    constructor(databaseService, userService) {
        this.databaseService = databaseService;
        this.userService = userService;
    }
    async getCorrectedUserId(userId) {
        const user = await this.userService.getUser(userId);
        return user?.user_id || userId;
    }
    parseMetadata(metadataJson) {
        if (!metadataJson)
            return undefined;
        try {
            return JSON.parse(metadataJson);
        }
        catch {
            return undefined;
        }
    }
    async getInventory(userId) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        // Supprimer automatiquement les items non-existants ou supprimés
        await this.databaseService.update(`DELETE FROM inventories 
       WHERE user_id = ? 
       AND item_id NOT IN (
         SELECT itemId FROM items WHERE deleted IS NULL OR deleted = 0
       )`, [correctedUserId]);
        // Récupérer les items avec toutes leurs données en une seule requête
        const items = await this.databaseService.read(`SELECT 
         inv.user_id, 
         inv.item_id, 
         inv.amount, 
         inv.metadata,
         inv.sellable,
         inv.purchasePrice,
         i.itemId,
         i.name,
         i.description,
         i.iconHash,
         i.price,
         i.owner,
         i.showInStore
       FROM inventories inv
       INNER JOIN items i ON inv.item_id = i.itemId AND (i.deleted IS NULL OR i.deleted = 0)
       WHERE inv.user_id = ? AND inv.amount > 0`, [correctedUserId]);
        items.sort((a, b) => {
            const nameCompare = a.name.localeCompare(b.name);
            if (nameCompare !== 0)
                return nameCompare;
            // Si même nom, trier par présence de métadonnées (sans métadonnées en premier)
            if (!a.metadata && b.metadata)
                return -1;
            if (a.metadata && !b.metadata)
                return 1;
            return 0;
        });
        const processedItems = items.map((item) => ({
            user_id: item.user_id,
            item_id: item.item_id,
            amount: item.amount,
            metadata: this.parseMetadata(item.metadata ?? null),
            sellable: !!item.sellable,
            purchasePrice: item.purchasePrice,
            // Données de l'item
            itemId: item.itemId,
            name: item.name,
            description: item.description,
            iconHash: item.iconHash,
            price: item.price,
            owner: item.owner,
            showInStore: item.showInStore
        }));
        return { user_id: userId, inventory: processedItems };
    }
    async getItemAmount(userId, itemId) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        const items = await this.databaseService.read("SELECT SUM(amount) as total FROM inventories WHERE user_id = ? AND item_id = ?", [correctedUserId, itemId]);
        return items.length === 0 || !items[0].amount ? 0 : items[0].amount;
    }
    async addItem(userId, itemId, amount, metadata, sellable = false, purchasePrice) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        if (metadata) {
            // Items avec métadonnées : créer des entrées uniques pour chaque quantité
            const metadataWithUniqueId = { ...metadata, _unique_id: (0, uuid_1.v4)() };
            for (let i = 0; i < amount; i++) {
                const uniqueMetadata = { ...metadataWithUniqueId, _unique_id: (0, uuid_1.v4)() };
                await this.databaseService.update("INSERT INTO inventories (user_id, item_id, amount, metadata, sellable, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)", [correctedUserId, itemId, 1, JSON.stringify(uniqueMetadata), sellable ? 1 : 0, purchasePrice]);
            }
        }
        else {
            // Items sans métadonnées : peuvent s'empiler seulement s'ils ont le même état sellable ET le même prix d'achat
            const items = await this.databaseService.read("SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = ? AND (purchasePrice = ? OR (purchasePrice IS NULL AND ? IS NULL))", [correctedUserId, itemId, sellable ? 1 : 0, purchasePrice, purchasePrice]);
            if (items.length > 0) {
                await this.databaseService.update("UPDATE inventories SET amount = amount + ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = ? AND (purchasePrice = ? OR (purchasePrice IS NULL AND ? IS NULL))", [amount, correctedUserId, itemId, sellable ? 1 : 0, purchasePrice, purchasePrice]);
            }
            else {
                await this.databaseService.update("INSERT INTO inventories (user_id, item_id, amount, metadata, sellable, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)", [correctedUserId, itemId, amount, null, sellable ? 1 : 0, purchasePrice]);
            }
        }
    }
    async setItemAmount(userId, itemId, amount) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        if (amount <= 0) {
            await this.databaseService.update(`DELETE FROM inventories WHERE user_id = ? AND item_id = ?`, [correctedUserId, itemId]);
            return;
        }
        // Items sans métadonnées seulement - par défaut sellable = false, pas de prix d'achat
        const items = await this.databaseService.read("SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL", [correctedUserId, itemId]);
        if (items.length > 0) {
            await this.databaseService.update(`UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL`, [amount, correctedUserId, itemId]);
        }
        else {
            await this.databaseService.update(`INSERT INTO inventories (user_id, item_id, amount, metadata, sellable, purchasePrice) VALUES (?, ?, ?, ?, ?, ?)`, [correctedUserId, itemId, amount, null, 0, null]);
        }
    }
    async updateItemMetadata(userId, itemId, uniqueId, metadata) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        const metadataWithUniqueId = { ...metadata, _unique_id: uniqueId };
        const metadataJson = JSON.stringify(metadataWithUniqueId);
        await this.databaseService.update("UPDATE inventories SET metadata = ? WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?", [metadataJson, correctedUserId, itemId, uniqueId]);
    }
    async removeItem(userId, itemId, amount) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        // Ne supprimer que les items SANS métadonnées
        const items = await this.databaseService.read(`SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL ORDER BY amount DESC`, [correctedUserId, itemId]);
        let remainingToRemove = amount;
        for (const item of items) {
            if (remainingToRemove <= 0)
                break;
            // Items sans métadonnées : peuvent être réduits
            const toRemoveFromStack = Math.min(remainingToRemove, item.amount);
            const newAmount = item.amount - toRemoveFromStack;
            if (newAmount <= 0) {
                await this.databaseService.update(`DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = ?`, [correctedUserId, itemId, item.sellable ? 1 : 0]);
            }
            else {
                await this.databaseService.update(`UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = ?`, [newAmount, correctedUserId, itemId, item.sellable ? 1 : 0]);
            }
            remainingToRemove -= toRemoveFromStack;
        }
    }
    async removeItemByUniqueId(userId, itemId, uniqueId) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        await this.databaseService.update(`DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?`, [correctedUserId, itemId, uniqueId]);
    }
    async hasItem(userId, itemId, amount = 1) {
        const totalAmount = await this.getItemAmount(userId, itemId);
        return totalAmount >= amount;
    }
    async hasItemWithoutMetadata(userId, itemId, amount = 1) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        const items = await this.databaseService.read("SELECT SUM(amount) as total FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL", [correctedUserId, itemId]);
        const totalAmount = items.length === 0 || !items[0].total ? 0 : items[0].total;
        return totalAmount >= amount;
    }
    // Nouvelle méthode pour vérifier les items sellable
    async hasItemWithoutMetadataSellable(userId, itemId, amount = 1) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        const items = await this.databaseService.read("SELECT SUM(amount) as total FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1", [correctedUserId, itemId]);
        const totalAmount = items.length === 0 || !items[0].total ? 0 : items[0].total;
        return totalAmount >= amount;
    }
    // Nouvelle méthode pour supprimer spécifiquement les items sellable
    async removeSellableItem(userId, itemId, amount) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        const items = await this.databaseService.read(`SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1 ORDER BY amount DESC`, [correctedUserId, itemId]);
        let remainingToRemove = amount;
        for (const item of items) {
            if (remainingToRemove <= 0)
                break;
            const toRemoveFromStack = Math.min(remainingToRemove, item.amount);
            const newAmount = item.amount - toRemoveFromStack;
            if (newAmount <= 0) {
                await this.databaseService.update(`DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1`, [correctedUserId, itemId]);
            }
            else {
                await this.databaseService.update(`UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1`, [newAmount, correctedUserId, itemId]);
            }
            remainingToRemove -= toRemoveFromStack;
        }
    }
    // Nouvelle méthode pour supprimer spécifiquement les items sellable avec un prix donné
    async removeSellableItemWithPrice(userId, itemId, amount, purchasePrice) {
        const correctedUserId = await this.getCorrectedUserId(userId);
        const items = await this.databaseService.read(`SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1 AND purchasePrice = ? ORDER BY amount DESC`, [correctedUserId, itemId, purchasePrice]);
        let remainingToRemove = amount;
        for (const item of items) {
            if (remainingToRemove <= 0)
                break;
            const toRemoveFromStack = Math.min(remainingToRemove, item.amount);
            const newAmount = item.amount - toRemoveFromStack;
            if (newAmount <= 0) {
                await this.databaseService.update(`DELETE FROM inventories WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1 AND purchasePrice = ?`, [correctedUserId, itemId, purchasePrice]);
            }
            else {
                await this.databaseService.update(`UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ? AND metadata IS NULL AND sellable = 1 AND purchasePrice = ?`, [newAmount, correctedUserId, itemId, purchasePrice]);
            }
            remainingToRemove -= toRemoveFromStack;
        }
    }
    async transferItem(fromUserId, toUserId, itemId, uniqueId) {
        const correctedFromUserId = await this.getCorrectedUserId(fromUserId);
        const correctedToUserId = await this.getCorrectedUserId(toUserId);
        // Vérifier que l'item existe dans l'inventaire du fromUser
        const items = await this.databaseService.read(`SELECT * FROM inventories WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?`, [correctedFromUserId, itemId, uniqueId]);
        if (items.length === 0) {
            throw new Error("Item not found in user's inventory");
        }
        // Transférer la propriété en changeant seulement le user_id
        await this.databaseService.update(`UPDATE inventories SET user_id = ? WHERE user_id = ? AND item_id = ? AND JSON_EXTRACT(metadata, '$._unique_id') = ?`, [correctedToUserId, correctedFromUserId, itemId, uniqueId]);
    }
};
InventoryService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("DatabaseService")),
    __param(1, (0, inversify_1.inject)("UserService")),
    __metadata("design:paramtypes", [Object, Object])
], InventoryService);
exports.InventoryService = InventoryService;
