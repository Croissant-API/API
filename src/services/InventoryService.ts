import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { InventoryRepository } from "../repositories/InventoryRepository";
import { Inventory } from "../interfaces/Inventory";
import { IUserService } from "./UserService";
import { v4 as uuidv4 } from "uuid";

export interface IInventoryService {
  getInventory(userId: string): Promise<Inventory>;
  getItemAmount(userId: string, itemId: string): Promise<number>;
  addItem(userId: string, itemId: string, amount: number, metadata?: { [key: string]: unknown }, sellable?: boolean, purchasePrice?: number): Promise<void>;
  removeItem(userId: string, itemId: string, amount: number, dataItemIndex?: number): Promise<void>;
  removeItemByUniqueId(userId: string, itemId: string, uniqueId: string): Promise<void>;
  setItemAmount(userId: string, itemId: string, amount: number): Promise<void>;
  updateItemMetadata(userId: string, itemId: string, uniqueId: string, metadata: { [key: string]: unknown }): Promise<void>;
  hasItem(userId: string, itemId: string, amount?: number): Promise<boolean>;
  hasItemWithoutMetadata(userId: string, itemId: string, amount?: number): Promise<boolean>;
  transferItem(fromUserId: string, toUserId: string, itemId: string, uniqueId: string): Promise<void>;
  hasItemWithoutMetadataSellable(userId: string, itemId: string, amount?: number): Promise<boolean>;
  removeSellableItem(userId: string, itemId: string, amount: number): Promise<void>;
  removeSellableItemWithPrice(userId: string, itemId: string, amount: number, purchasePrice: number, dataItemIndex?: number): Promise<void>;
}

@injectable()
export class InventoryService implements IInventoryService {
  private inventoryRepository: InventoryRepository;
  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService,
    @inject("UserService") private userService: IUserService
  ) {
    this.inventoryRepository = new InventoryRepository(this.databaseService);
  }

  private async getCorrectedUserId(userId: string): Promise<string> {
    const user = await this.userService.getUser(userId);
    return user?.user_id || userId;
  }

  async getInventory(userId: string): Promise<Inventory> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    await this.inventoryRepository.deleteNonExistingItems(correctedUserId);
    const items = await this.inventoryRepository.getInventoryItems(correctedUserId);
    return { user_id: userId, inventory: items };
  }

  async getItemAmount(userId: string, itemId: string): Promise<number> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    return await this.inventoryRepository.getItemAmount(correctedUserId, itemId);
  }

  async addItem(userId: string, itemId: string, amount: number, metadata?: { [key: string]: unknown }, sellable: boolean = false, purchasePrice?: number): Promise<void> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    await this.inventoryRepository.addItem(correctedUserId, itemId, amount, metadata, sellable, purchasePrice, uuidv4);
  }

  async setItemAmount(userId: string, itemId: string, amount: number): Promise<void> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    await this.inventoryRepository.setItemAmount(correctedUserId, itemId, amount);
  }

  async updateItemMetadata(userId: string, itemId: string, uniqueId: string, metadata: { [key: string]: unknown }): Promise<void> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    await this.inventoryRepository.updateItemMetadata(correctedUserId, itemId, uniqueId, metadata);
  }

  async removeItem(userId: string, itemId: string, amount: number, dataItemIndex?: number): Promise<void> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    await this.inventoryRepository.removeItem(correctedUserId, itemId, amount, dataItemIndex);
  }

  async removeItemByUniqueId(userId: string, itemId: string, uniqueId: string): Promise<void> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    await this.inventoryRepository.removeItemByUniqueId(correctedUserId, itemId, uniqueId);
  }

  async hasItem(userId: string, itemId: string, amount = 1): Promise<boolean> {
    const totalAmount = await this.getItemAmount(userId, itemId);
    return totalAmount >= amount;
  }

  async hasItemWithoutMetadata(userId: string, itemId: string, amount = 1): Promise<boolean> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    return await this.inventoryRepository.hasItemWithoutMetadata(correctedUserId, itemId, amount);
  }

  // Nouvelle méthode pour vérifier les items sellable
  async hasItemWithoutMetadataSellable(userId: string, itemId: string, amount = 1): Promise<boolean> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    return await this.inventoryRepository.hasItemWithoutMetadataSellable(correctedUserId, itemId, amount);
  }

  // Nouvelle méthode pour supprimer spécifiquement les items sellable
  async removeSellableItem(userId: string, itemId: string, amount: number): Promise<void> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    await this.inventoryRepository.removeSellableItem(correctedUserId, itemId, amount);
  }

  // Nouvelle méthode pour supprimer spécifiquement les items sellable avec un prix donné
  async removeSellableItemWithPrice(userId: string, itemId: string, amount: number, purchasePrice: number, dataItemIndex: number): Promise<void> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    await this.inventoryRepository.removeSellableItemWithPrice(correctedUserId, itemId, amount, purchasePrice, dataItemIndex);
  }

  async transferItem(fromUserId: string, toUserId: string, itemId: string, uniqueId: string): Promise<void> {
    const correctedFromUserId = await this.getCorrectedUserId(fromUserId);
    const correctedToUserId = await this.getCorrectedUserId(toUserId);
    await this.inventoryRepository.transferItem(correctedFromUserId, correctedToUserId, itemId, uniqueId);
  }
}
