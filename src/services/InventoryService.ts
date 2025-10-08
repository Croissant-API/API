import { inject, injectable } from 'inversify';
import { v4 as uuidv4 } from 'uuid';
import { Inventory } from '../interfaces/Inventory';
import { InventoryRepository } from '../repositories/InventoryRepository';
import { IDatabaseService } from './DatabaseService';
import { IUserService } from './UserService';

export interface IInventoryService {
  getInventory(userId: string): Promise<Inventory>;
  addItem(userId: string, itemId: string, amount: number, metadata?: { [key: string]: unknown }, sellable?: boolean, purchasePrice?: number): Promise<void>;
  removeItem(userId: string, itemId: string, amount: number, dataItemIndex?: number): Promise<void>;
  removeItemByUniqueId(userId: string, itemId: string, uniqueId: string): Promise<void>;
  setItemAmount(userId: string, itemId: string, amount: number): Promise<void>;
  updateItemMetadata(userId: string, itemId: string, uniqueId: string, metadata: { [key: string]: unknown }): Promise<void>;
  transferItem(fromUserId: string, toUserId: string, itemId: string, uniqueId: string): Promise<void>;
  getInventoryRepository(): InventoryRepository;
  getCorrectedUserId(userId: string): Promise<string>;
}

@injectable()
export class InventoryService implements IInventoryService {
  private inventoryRepository: InventoryRepository;
  constructor(
    @inject('DatabaseService') private databaseService: IDatabaseService,
    @inject('UserService') private userService: IUserService
  ) {
    this.inventoryRepository = new InventoryRepository(this.databaseService);
  }

  getInventoryRepository(): InventoryRepository {
    return this.inventoryRepository;
  }

  async getCorrectedUserId(userId: string): Promise<string> {
    return (await this.userService.getUser(userId))?.user_id || userId;
  }

  async getInventory(userId: string): Promise<Inventory> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    await this.inventoryRepository.deleteNonExistingItems(correctedUserId);
    const items = await this.inventoryRepository.getInventoryItems(correctedUserId);
    return { user_id: userId, inventory: items };
  }

  async addItem(userId: string, itemId: string, amount: number, metadata?: { [key: string]: unknown }, sellable = false, purchasePrice?: number): Promise<void> {
    await this.inventoryRepository.addItem(await this.getCorrectedUserId(userId), itemId, amount, metadata, sellable, purchasePrice, uuidv4);
  }

  async setItemAmount(userId: string, itemId: string, amount: number): Promise<void> {
    await this.inventoryRepository.setItemAmount(await this.getCorrectedUserId(userId), itemId, amount);
  }

  async updateItemMetadata(userId: string, itemId: string, uniqueId: string, metadata: { [key: string]: unknown }): Promise<void> {
    await this.inventoryRepository.updateItemMetadata(await this.getCorrectedUserId(userId), itemId, uniqueId, metadata);
  }

  async removeItem(userId: string, itemId: string, amount: number, dataItemIndex?: number): Promise<void> {
    await this.inventoryRepository.removeItem(await this.getCorrectedUserId(userId), itemId, amount, dataItemIndex);
  }

  async removeItemByUniqueId(userId: string, itemId: string, uniqueId: string): Promise<void> {
    await this.inventoryRepository.removeItemByUniqueId(await this.getCorrectedUserId(userId), itemId, uniqueId);
  }

  async transferItem(fromUserId: string, toUserId: string, itemId: string, uniqueId: string): Promise<void> {
    await this.inventoryRepository.transferItem(await this.getCorrectedUserId(fromUserId), await this.getCorrectedUserId(toUserId), itemId, uniqueId);
  }
}
