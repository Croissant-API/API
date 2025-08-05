import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { Inventory, InventoryItem } from "../interfaces/Inventory";
import { IUserService } from "./UserService";
import { v4 as uuidv4 } from "uuid";
import { Knex } from "knex";

export interface IInventoryService {
  getInventory(userId: string): Promise<Inventory>;
  getItemAmount(userId: string, itemId: string): Promise<number>;
  addItem(userId: string, itemId: string, amount: number, metadata?: { [key: string]: unknown }, sellable?: boolean, purchasePrice?: number): Promise<void>;
  removeItem(userId: string, itemId: string, amount: number): Promise<void>;
  removeItemByUniqueId(userId: string, itemId: string, uniqueId: string): Promise<void>;
  setItemAmount(userId: string, itemId: string, amount: number): Promise<void>;
  updateItemMetadata(userId: string, itemId: string, uniqueId: string, metadata: { [key: string]: unknown }): Promise<void>;
  hasItem(userId: string, itemId: string, amount?: number): Promise<boolean>;
  hasItemWithoutMetadata(userId: string, itemId: string, amount?: number): Promise<boolean>;
  transferItem(fromUserId: string, toUserId: string, itemId: string, uniqueId: string): Promise<void>;
  hasItemWithoutMetadataSellable(userId: string, itemId: string, amount?: number): Promise<boolean>;
  removeSellableItem(userId: string, itemId: string, amount: number): Promise<void>;
  removeSellableItemWithPrice(userId: string, itemId: string, amount: number, purchasePrice: number): Promise<void>;
}

@injectable()
export class InventoryService implements IInventoryService {
  private readonly inventoriesTable = 'inventories';
  private readonly itemsTable = 'items';

  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService,
    @inject("UserService") private userService: IUserService
  ) { }

  private async getCorrectedUserId(userId: string): Promise<string> {
    const user = await this.userService.getUser(userId);
    return user?.user_id || userId;
  }

  private parseMetadata(metadataJson: string | null): { [key: string]: unknown } | undefined {
    if (!metadataJson) return undefined;
    try {
      return JSON.parse(metadataJson);
    } catch {
      return undefined;
    }
  }

  async getInventory(userId: string): Promise<Inventory> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    const knex = this.databaseService.getKnex();

    try {
      // Supprimer automatiquement les items non-existants ou supprimés
      await knex(this.inventoriesTable)
        .where({ user_id: correctedUserId })
        .whereNotIn('item_id', (qb: Knex.QueryBuilder) => {
          qb.select('itemId').from(this.itemsTable).whereNull('deleted').orWhere({ deleted: 0 });
        })
        .delete();

      // Récupérer les items avec toutes leurs données en une seule requête
      const items: InventoryItem[] = await knex(this.inventoriesTable + ' as inv')
        .join(this.itemsTable + ' as i', function() {
          this.on('inv.item_id', '=', 'i.itemId').andOn(knex.raw('i.deleted IS NULL OR i.deleted = 0'));
        })
        .select(
          'inv.user_id',
          'inv.item_id',
          'inv.amount',
          'inv.metadata',
          'inv.sellable',
          'inv.purchasePrice',
          'i.itemId',
          'i.name',
          'i.description',
          'i.iconHash',
          'i.price',
          'i.owner',
          'i.showInStore'
        )
        .where({ 'inv.user_id': correctedUserId })
        .andWhere('inv.amount', '>', 0);

      items.sort((a: InventoryItem, b: InventoryItem) => {
        const nameCompare = a.name?.localeCompare(b.name || '') || 0;
        if (nameCompare !== 0) return nameCompare;
        // Si même nom, trier par présence de métadonnées (sans métadonnées en premier)
        if (!a.metadata && b.metadata) return -1;
        if (a.metadata && !b.metadata) return 1;
        return 0;
      });

      const processedItems: InventoryItem[] = items.map((item) => ({
        user_id: item.user_id,
        item_id: item.item_id,
        amount: item.amount,
        metadata: item.metadata,
        sellable: !!item.sellable,
        purchasePrice: item.purchasePrice,
        // Données de l'item
        name: item.name,
        description: item.description,
        iconHash: item.iconHash,
        price: item.purchasePrice
      }));

      return { user_id: userId, inventory: processedItems };
    } catch (error) {
      console.error("Error getting inventory:", error);
      throw error;
    }
  }

  async getItemAmount(userId: string, itemId: string): Promise<number> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    const knex = this.databaseService.getKnex();

    try {
      const result = await knex(this.inventoriesTable)
        .sum('amount as total')
        .where({ user_id: correctedUserId, item_id: itemId })
        .first();

      return (result?.total as number) || 0;
    } catch (error) {
      console.error("Error getting item amount:", error);
      throw error;
    }
  }

  async addItem(userId: string, itemId: string, amount: number, metadata?: { [key: string]: unknown }, sellable: boolean = false, purchasePrice?: number): Promise<void> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    const knex = this.databaseService.getKnex();

    try {
      if (metadata) {
        // Items avec métadonnées : créer des entrées uniques pour chaque quantité
        for (let i = 0; i < amount; i++) {
          const uniqueId = uuidv4();
          const uniqueMetadata = { ...metadata, _unique_id: uniqueId };

          await knex(this.inventoriesTable).insert({
            user_id: correctedUserId,
            item_id: itemId,
            amount: 1,
            metadata: JSON.stringify(uniqueMetadata),
            sellable: sellable ? 1 : 0,
            purchasePrice: purchasePrice
          });
        }
      } else {
        // Items sans métadonnées : peuvent s'empiler seulement s'ils ont le même état sellable ET le même prix d'achat
        const existingItem = await knex(this.inventoriesTable)
          .where({
            user_id: correctedUserId,
            item_id: itemId,
            metadata: null,
            sellable: sellable ? 1 : 0,
            purchasePrice: purchasePrice
          })
          .first();

        if (existingItem) {
          await knex(this.inventoriesTable)
            .where({
              user_id: correctedUserId,
              item_id: itemId,
              metadata: null,
              sellable: sellable ? 1 : 0,
              purchasePrice: purchasePrice
            })
            .increment('amount', amount);
        } else {
          await knex(this.inventoriesTable).insert({
            user_id: correctedUserId,
            item_id: itemId,
            amount: amount,
            metadata: null,
            sellable: sellable ? 1 : 0,
            purchasePrice: purchasePrice
          });
        }
      }
    } catch (error) {
      console.error("Error adding item:", error);
      throw error;
    }
  }

  async setItemAmount(userId: string, itemId: string, amount: number): Promise<void> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    const knex = this.databaseService.getKnex();

    try {
      if (amount <= 0) {
        await knex(this.inventoriesTable)
          .where({ user_id: correctedUserId, item_id: itemId })
          .delete();
        return;
      }

      const existingItem = await knex(this.inventoriesTable)
        .where({ user_id: correctedUserId, item_id: itemId, metadata: null })
        .first();

      if (existingItem) {
        await knex(this.inventoriesTable)
          .where({ user_id: correctedUserId, item_id: itemId, metadata: null })
          .update({ amount: amount });
      } else {
        await knex(this.inventoriesTable).insert({
          user_id: correctedUserId,
          item_id: itemId,
          amount: amount,
          metadata: null,
          sellable: 0,
          purchasePrice: null
        });
      }
    } catch (error) {
      console.error("Error setting item amount:", error);
      throw error;
    }
  }

  async updateItemMetadata(userId: string, itemId: string, uniqueId: string, metadata: { [key: string]: unknown }): Promise<void> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    const knex = this.databaseService.getKnex();

    try {
      const metadataWithUniqueId = { ...metadata, _unique_id: uniqueId };
      const metadataJson = JSON.stringify(metadataWithUniqueId);

      await knex(this.inventoriesTable)
        .where({ user_id: correctedUserId, item_id: itemId })
        .where(knex.raw(`JSON_EXTRACT(metadata, '$._unique_id') = ?`, uniqueId))
        .update({ metadata: metadataJson });
    } catch (error) {
      console.error("Error updating item metadata:", error);
      throw error;
    }
  }

  async removeItem(userId: string, itemId: string, amount: number): Promise<void> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    const knex = this.databaseService.getKnex();

    try {
      const items = await knex(this.inventoriesTable)
        .where({ user_id: correctedUserId, item_id: itemId, metadata: null })
        .orderBy('amount', 'desc');

      let remainingToRemove = amount;

      for (const item of items) {
        if (remainingToRemove <= 0) break;

        const toRemoveFromStack = Math.min(remainingToRemove, item.amount);
        const newAmount = item.amount - toRemoveFromStack;

        if (newAmount <= 0) {
          await knex(this.inventoriesTable)
            .where({ user_id: correctedUserId, item_id: itemId, metadata: null, sellable: item.sellable ? 1 : 0 })
            .delete();
        } else {
          await knex(this.inventoriesTable)
            .where({ user_id: correctedUserId, item_id: itemId, metadata: null, sellable: item.sellable ? 1 : 0 })
            .update({ amount: newAmount });
        }
        remainingToRemove -= toRemoveFromStack;
      }
    } catch (error) {
      console.error("Error removing item:", error);
      throw error;
    }
  }

  async removeItemByUniqueId(userId: string, itemId: string, uniqueId: string): Promise<void> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    const knex = this.databaseService.getKnex();

    try {
      await knex(this.inventoriesTable)
        .where({ user_id: correctedUserId, item_id: itemId })
        .where(knex.raw(`JSON_EXTRACT(metadata, '$._unique_id') = ?`, uniqueId))
        .delete();
    } catch (error) {
      console.error("Error removing item by unique ID:", error);
      throw error;
    }
  }

  async hasItem(userId: string, itemId: string, amount = 1): Promise<boolean> {
    const totalAmount = await this.getItemAmount(userId, itemId);
    return totalAmount >= amount;
  }

  async hasItemWithoutMetadata(userId: string, itemId: string, amount = 1): Promise<boolean> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    const knex = this.databaseService.getKnex();

    try {
      const result = await knex(this.inventoriesTable)
        .sum('amount as total')
        .where({ user_id: correctedUserId, item_id: itemId, metadata: null })
        .first();

      const totalAmount = (result?.total as number) || 0;
      return totalAmount >= amount;
    } catch (error) {
      console.error("Error checking item without metadata:", error);
      throw error;
    }
  }

  async hasItemWithoutMetadataSellable(userId: string, itemId: string, amount = 1): Promise<boolean> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    const knex = this.databaseService.getKnex();

    try {
      const result = await knex(this.inventoriesTable)
        .sum('amount as total')
        .where({ user_id: correctedUserId, item_id: itemId, metadata: null, sellable: 1 })
        .first();

      const totalAmount = (result?.total as number) || 0;
      return totalAmount >= amount;
    } catch (error) {
      console.error("Error checking sellable item without metadata:", error);
      throw error;
    }
  }

  async removeSellableItem(userId: string, itemId: string, amount: number): Promise<void> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    const knex = this.databaseService.getKnex();

    try {
      const items = await knex(this.inventoriesTable)
        .where({ user_id: correctedUserId, item_id: itemId, metadata: null, sellable: 1 })
        .orderBy('amount', 'desc');

      let remainingToRemove = amount;

      for (const item of items) {
        if (remainingToRemove <= 0) break;

        const toRemoveFromStack = Math.min(remainingToRemove, item.amount);
        const newAmount = item.amount - toRemoveFromStack;

        if (newAmount <= 0) {
          await knex(this.inventoriesTable)
            .where({ user_id: correctedUserId, item_id: itemId, metadata: null, sellable: 1 })
            .delete();
        } else {
          await knex(this.inventoriesTable)
            .where({ user_id: correctedUserId, item_id: itemId, metadata: null, sellable: 1 })
            .update({ amount: newAmount });
        }
        remainingToRemove -= toRemoveFromStack;
      }
    } catch (error) {
      console.error("Error removing sellable item:", error);
      throw error;
    }
  }

  async removeSellableItemWithPrice(userId: string, itemId: string, amount: number, purchasePrice: number): Promise<void> {
    const correctedUserId = await this.getCorrectedUserId(userId);
    const knex = this.databaseService.getKnex();

    try {
      const items = await knex(this.inventoriesTable)
        .where({ user_id: correctedUserId, item_id: itemId, metadata: null, sellable: 1, purchasePrice: purchasePrice })
        .orderBy('amount', 'desc');

      let remainingToRemove = amount;

      for (const item of items) {
        if (remainingToRemove <= 0) break;

        const toRemoveFromStack = Math.min(remainingToRemove, item.amount);
        const newAmount = item.amount - toRemoveFromStack;

        if (newAmount <= 0) {
          await knex(this.inventoriesTable)
            .where({ user_id: correctedUserId, item_id: itemId, metadata: null, sellable: 1, purchasePrice: purchasePrice })
            .delete();
        } else {
          await knex(this.inventoriesTable)
            .where({ user_id: correctedUserId, item_id: itemId, metadata: null, sellable: 1, purchasePrice: purchasePrice })
            .update({ amount: newAmount });
        }
        remainingToRemove -= toRemoveFromStack;
      }
    } catch (error) {
      console.error("Error removing sellable item with price:", error);
      throw error;
    }
  }

  async transferItem(fromUserId: string, toUserId: string, itemId: string, uniqueId: string): Promise<void> {
    const correctedFromUserId = await this.getCorrectedUserId(fromUserId);
    const correctedToUserId = await this.getCorrectedUserId(toUserId);
    const knex = this.databaseService.getKnex();

    try {
      // Vérifier que l'item existe dans l'inventaire du fromUser
      const item = await knex(this.inventoriesTable)
        .where({ user_id: correctedFromUserId, item_id: itemId })
        .where(knex.raw(`JSON_EXTRACT(metadata, '$._unique_id') = ?`, uniqueId))
        .first();

      if (!item) {
        throw new Error("Item not found in user's inventory");
      }

      // Transférer la propriété en changeant seulement le user_id
      await knex(this.inventoriesTable)
        .where({ user_id: correctedFromUserId, item_id: itemId })
        .where(knex.raw(`JSON_EXTRACT(metadata, '$._unique_id') = ?`, uniqueId))
        .update({ user_id: correctedToUserId });
    } catch (error) {
      console.error("Error transferring item:", error);
      throw error;
    }
  }
}
