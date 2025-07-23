import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { Inventory, InventoryItem } from "../interfaces/Inventory";
import { IUserService } from "./UserService";

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
    @inject("DatabaseService") private databaseService: IDatabaseService,
    @inject("UserService") private userService: IUserService
  ) {}

  private async getCorrectedUserId(userId: string): Promise<string> {
    const user = await this.userService.getUser(userId);
    return user?.user_id || userId;
  }

  async getInventory(userId: string): Promise<Inventory> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    const items = await this.databaseService.read<InventoryItem[]>(
      "SELECT user_id, item_id, amount FROM inventories WHERE user_id = ?",
      [correctedUserId]
    );
    return { user_id: userId, inventory: items.filter((item: { amount: number; }) => item.amount > 0) };
  }

  async getItemAmount(userId: string, itemId: string): Promise<number> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    const items = await this.databaseService.read<InventoryItem[]>(
      "SELECT amount FROM inventories WHERE user_id = ? AND item_id = ?",
      [correctedUserId, itemId]
    );
    return items.length === 0 ? 0 : items[0].amount;
  }

  async addItem(userId: string, itemId: string, amount: number): Promise<void> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    const items = await this.databaseService.read<InventoryItem[]>(
      "SELECT * FROM inventories WHERE user_id = ? AND item_id = ?",
      [correctedUserId, itemId]
    );
    if (items.length > 0) {
      await this.databaseService.update(
        "UPDATE inventories SET amount = amount + ? WHERE user_id = ? AND item_id = ?",
        [amount, correctedUserId, itemId]
      );
    } else {
      await this.databaseService.update(
        "INSERT INTO inventories (user_id, item_id, amount) VALUES (?, ?, ?)",
        [correctedUserId, itemId, amount]
      );
    }
  }

  async removeItem(userId: string, itemId: string, amount: number): Promise<void> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    await this.databaseService.update(
      `UPDATE inventories SET amount = MAX(amount - ?, 0) WHERE user_id = ? AND item_id = ?`,
      [amount, correctedUserId, itemId]
    );
  }

  async setItemAmount(userId: string, itemId: string, amount: number): Promise<void> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    await this.databaseService.update(
      `UPDATE inventories SET amount = ? WHERE user_id = ? AND item_id = ?`,
      [amount, correctedUserId, itemId]
    );
  }

  async hasItem(userId: string, itemId: string, amount = 1): Promise<boolean> {
    const items = await this.getInventory(userId);
    const item = items.inventory.find((item) => item.item_id === itemId);
    if (!item) return false;
    return item.amount >= amount;
  }
}
