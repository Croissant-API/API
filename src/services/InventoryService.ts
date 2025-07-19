import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { Inventory, InventoryItem } from "../interfaces/Inventory";

export interface IInventoryService {
    getInventory(userId: string): Promise<Inventory>;
    getItemAmount(userId: string, itemId: string): Promise<number>;
    addItem(userId: string, itemId: string, amount: number): Promise<void>;
    removeItem(userId: string, itemId: string, amount: number): Promise<void>;
    setItemAmount(userId: string, itemId: string, amount: number): Promise<void>;
    hasItem(userId: string, itemId: string, amount?: number): Promise<boolean>;
}

@injectable()
export class InventoryService implements IInventoryService {
    constructor(
        @inject("DatabaseService") private databaseService: IDatabaseService
    ) {}

    async getInventory(userId: string): Promise<Inventory> {
        const items = await this.databaseService.read<InventoryItem[]>(
            "SELECT user_id, item_id, amount FROM inventories WHERE user_id = ?",
            [userId]
        );
        const filteredItems = items
            .filter(item => item.amount > 0); // Filter out items with amount <= 0
        return { user_id: userId, inventory: filteredItems };
    }

    async getItemAmount(userId: string, itemId: string): Promise<number> {
        const items = await this.databaseService.read<InventoryItem[]>(
            "SELECT amount FROM inventories WHERE user_id = ? AND item_id = ?",
            [userId, itemId]
        );
        if (items.length === 0) return 0;
        return items[0].amount;
    }

    async addItem(userId: string, itemId: string, amount: number): Promise<void> {
        // Check if the item already exists
        const items = await this.databaseService.read<InventoryItem[]>(
            "SELECT * FROM inventories WHERE user_id = ? AND item_id = ?",
            [userId, itemId]
        );
        if (items.length > 0) {
            // Item exists, update the amount
            await this.databaseService.update(
                "UPDATE inventories SET amount = amount + ? WHERE user_id = ? AND item_id = ?",
                [amount, userId, itemId]
            );
        } else {
            // Item does not exist, insert new row
            await this.databaseService.update(
                "INSERT INTO inventories (user_id, item_id, amount) VALUES (?, ?, ?)",
                [userId, itemId, amount]
            );
        }
    }

    async removeItem(userId: string, itemId: string, amount: number): Promise<void> {
        // Decrease amount, but not below zero
        await this.databaseService.update(
            `UPDATE inventories SET amount = MAX(amount - ?, 0)
             WHERE user_id = ? AND item_id = ?`,
            [amount, userId, itemId]
        );
    }

    async setItemAmount(userId: string, itemId: string, amount: number): Promise<void> {
        await this.databaseService.update(
            `UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ?`,
            [amount, userId, itemId]
        );
    }

    async hasItem(userId: string, itemId: string, amount = 1): Promise<boolean> {
        const items = await this.getInventory(userId);
        const item = items.inventory.find(item => item.item_id === itemId);
        if (!item) return false;
        return item.amount >= amount;
    }
}
