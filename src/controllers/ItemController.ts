
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Context } from 'hono';
import { inject, injectable } from 'inversify';
import { v4 } from 'uuid';
import { controller, httpDelete, httpGet, httpPost, httpPut } from '../hono-inversify';
import { LoggedCheck } from '../middlewares/LoggedCheck';
import { OwnerCheck } from '../middlewares/OwnerCheck';
import { createRateLimit } from '../middlewares/hono/rateLimit';
import { IInventoryService } from '../services/InventoryService';
import { IItemService } from '../services/ItemService';
import { ILogService } from '../services/LogService';
import { IUserService } from '../services/UserService';

const createItemRateLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 50, message: 'Too many item creations, please try again later.' });
const updateItemRateLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 100, message: 'Too many item updates, please try again later.' });
const deleteItemRateLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 50, message: 'Too many item deletions, please try again later.' });
const buyItemRateLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 200, message: 'Too many item purchases, please try again later.' });
const sellItemRateLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 200, message: 'Too many item sales, please try again later.' });
// const consumeItemRateLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 1000, message: 'Too many item consumptions, please try again later.' });
const dropItemRateLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 1000, message: 'Too many item drops, please try again later.' });
const transferOwnershipRateLimit = createRateLimit({ windowMs: 60 * 60 * 1000, max: 500, message: 'Too many ownership transfers, please try again later.' });

@injectable()
@controller('/items')
export class Items {
  constructor(
    @inject('ItemService') private itemService: IItemService,
    @inject('InventoryService') private inventoryService: IInventoryService,
    @inject('UserService') private userService: IUserService,
    @inject('LogService') private logService: ILogService
  ) { }

  @httpPost('/giveItem/:itemId', LoggedCheck, OwnerCheck)
  public async giveItem(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) return this.sendError(c, 401, 'Unauthorized');
    const itemId = c.req.param('itemId');
    const { targetUserId, metadata, amount } = await c.req.json();
    if (!itemId || !targetUserId) {
      await this.createLog(c, 'giveItem', 'inventory', 400, user.user_id, { reason: 'missing_required_fields', itemId, targetUserId });
      return this.sendError(c, 400, 'Invalid input: itemId and targetUserId are required');
    }
    try {
      const targetUser = await this.userService.getUser(targetUserId);
      if (!targetUser) {
        await this.createLog(c, 'giveItem', 'inventory', 404, user.user_id, { itemId, targetUserId, reason: 'target_user_not_found' });
        return this.sendError(c, 404, 'Target user not found');
      }
      const item = await this.itemService.getItem(itemId);
      if (!item || item.deleted) {
        await this.createLog(c, 'giveItem', 'inventory', 404, user.user_id, { itemId, targetUserId });
        return this.sendError(c, 404, 'Item not found');
      }
      const repo = this.inventoryService.getInventoryRepository();
      const correctedUserId = await this.inventoryService.getCorrectedUserId(targetUser.user_id);
      await repo.addItem(correctedUserId, itemId, amount, metadata ?? {}, false, undefined, v4);
      await this.createLog(c, 'giveItem', 'inventory', 200, user.user_id, { itemId, targetUserId, metadata, itemName: item.name });
      return c.json({ message: 'Item given with metadata' });
    } catch (error) {
      await this.createLog(c, 'giveItem', 'inventory', 500, user.user_id, { itemId, targetUserId, metadata, error: error instanceof Error ? error.message : String(error) });
      return this.sendError(c, 500, 'Error giving item');
    }
  }

  private sendError(c: Context, status: number, message: string) {
    return c.json({ message }, status as any);
  }

  private async createLog(c: Context, action: string, tableName: string, statusCode?: number, userId?: string, metadata?: object) {
    try {
      const clientIP = c.req.header('cf-connecting-ip') ||
        c.req.header('x-forwarded-for') ||
        c.req.header('x-real-ip') ||
        'unknown';
      await this.logService.createLog({
        ip_address: clientIP,
        table_name: tableName,
        controller: `ItemController.${action}`,
        original_path: c.req.path,
        http_method: c.req.method,
        request_body: JSON.stringify(metadata || {}),
        user_id: userId,
        status_code: statusCode,
      });
    } catch (error) {
      console.error('Failed to log action:', error);
    }
  }

  private getUserFromContext(c: Context) {
    return c.get('user');
  }

  @httpGet('/')
  public async getAllItems(c: Context) {
    try {
      const items = await this.itemService.getStoreItems();
      await this.createLog(c, 'getAllItems', 'items', 200, undefined, { items_count: items.length });
      return c.json(items);
    } catch (error) {
      await this.createLog(c, 'getAllItems', 'items', 500, undefined, { error: error instanceof Error ? error.message : String(error) });
      return this.sendError(c, 500, 'Error fetching items');
    }
  }

  @httpGet('/@mine', LoggedCheck)
  public async getMyItems(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) {
      await this.createLog(c, 'getMyItems', 'items', 401);
      return this.sendError(c, 401, 'Unauthorized');
    }
    try {
      const items = await this.itemService.getMyItems(user.user_id);
      await this.createLog(c, 'getMyItems', 'items', 200, user.user_id, { owned_items_count: items.length });
      return c.json(items);
    } catch (error) {
      await this.createLog(c, 'getMyItems', 'items', 500, user.user_id, { error: error instanceof Error ? error.message : String(error) });
      return this.sendError(c, 500, 'Error fetching your items');
    }
  }

  @httpGet('/search')
  public async searchItems(c: Context) {
    const query = c.req.query('q')?.trim();
    if (!query) {
      await this.createLog(c, 'searchItems', 'items', 400, undefined, { reason: 'missing_search_query' });
      return this.sendError(c, 400, 'Missing search query');
    }
    try {
      const items = await this.itemService.searchItemsByName(query);
      await this.createLog(c, 'searchItems', 'items', 200, undefined, { search_query: query, results_count: items.length });
      return c.json(items);
    } catch (error) {
      await this.createLog(c, 'searchItems', 'items', 500, undefined, { search_query: query, error: error instanceof Error ? error.message : String(error) });
      return this.sendError(c, 500, 'Error searching items');
    }
  }

  @httpGet('/:itemId')
  public async getItem(c: Context) {
    const itemId = c.req.param('itemId');
    try {
      const item = await this.itemService.getItem(itemId);
      if (!item || item.deleted) {
        await this.createLog(c, 'getItem', 'items', 404, undefined, { itemId });
        return this.sendError(c, 404, 'Item not found');
      }
      await this.createLog(c, 'getItem', 'items', 200, undefined, { itemId, item_name: item.name, item_price: item.price });
      return c.json(item);
    } catch (error) {
      await this.createLog(c, 'getItem', 'items', 500, undefined, { itemId, error: error instanceof Error ? error.message : String(error) });
      return this.sendError(c, 500, 'Error fetching item');
    }
  }

  @httpPost('/create', LoggedCheck, createItemRateLimit)
  public async createItem(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) return this.sendError(c, 401, 'Unauthorized');
    const body = await c.req.json();
    // TODO: validate body with createItemValidator
    const itemId = v4();
    const { name, description, price, iconHash, showInStore } = body;
    try {
      await this.itemService.createItem({
        itemId,
        name: name ?? null,
        description: description ?? null,
        price: price ?? 0,
        owner: user.user_id,
        iconHash: iconHash ?? null,
        showInStore: showInStore ?? false,
        deleted: false,
      });
      await this.createLog(c, 'createItem', 'items', 201, user.user_id, { itemId, item_name: name, item_price: price, show_in_store: showInStore });
      return c.json({ message: 'Item created' }, 201);
    } catch (error) {
      await this.createLog(c, 'createItem', 'items', 500, user.user_id, { item_name: name, error: error instanceof Error ? error.message : String(error) });
      return this.sendError(c, 500, 'Error creating item');
    }
  }

  @httpPut('/update/:itemId', LoggedCheck, OwnerCheck, updateItemRateLimit)
  public async updateItem(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) return this.sendError(c, 401, 'Unauthorized');
    const itemId = c.req.param('itemId');
    const body = await c.req.json();
    // TODO: validate body with updateItemValidator
    const { name, description, price, iconHash, showInStore } = body;
    try {
      await this.itemService.updateItem(itemId, {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
        ...(iconHash !== undefined && { iconHash }),
        ...(showInStore !== undefined && { showInStore }),
      });
      await this.createLog(c, 'updateItem', 'items', 200, user.user_id, { itemId, updated_fields: body });
      return c.json({ message: 'Item updated' });
    } catch (error) {
      await this.createLog(c, 'updateItem', 'items', 500, user.user_id, { itemId, error: error instanceof Error ? error.message : String(error) });
      return this.sendError(c, 500, 'Error updating item');
    }
  }

  @httpDelete('/delete/:itemId', LoggedCheck, OwnerCheck, deleteItemRateLimit)
  public async deleteItem(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) return this.sendError(c, 401, 'Unauthorized');
    const itemId = c.req.param('itemId');
    try {
      await this.itemService.deleteItem(itemId);
      await this.createLog(c, 'deleteItem', 'items', 200, user.user_id, { itemId, action: 'deleted' });
      return c.json({ message: 'Item deleted' });
    } catch (error) {
      await this.createLog(c, 'deleteItem', 'items', 500, user.user_id, { itemId, error: error instanceof Error ? error.message : String(error) });
      return this.sendError(c, 500, 'Error deleting item');
    }
  }

  @httpPost('/buy/:itemId', LoggedCheck, buyItemRateLimit)
  public async buyItem(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) return this.sendError(c, 401, 'Unauthorized');
    const itemId = c.req.param('itemId');
    const { amount } = await c.req.json();
    if (!itemId || isNaN(amount)) {
      await this.createLog(c, 'buyItem', 'inventory', 400, user.user_id, { reason: 'invalid_input', itemId, amount });
      return this.sendError(c, 400, 'Invalid input');
    }
    try {
      const item = await this.itemService.getItem(itemId);
      if (!item || item.deleted) {
        await this.createLog(c, 'buyItem', 'inventory', 404, user.user_id, { itemId });
        return this.sendError(c, 404, 'Item not found');
      }
      const owner = await this.userService.getUser(item.owner);
      if (!owner) {
        await this.createLog(c, 'buyItem', 'inventory', 404, user.user_id, { itemId, reason: 'owner_not_found' });
        return this.sendError(c, 404, 'Owner not found');
      }
      const totalCost = item.price * amount;
      const isOwner = user.user_id === item.owner;
      if (!isOwner && user.balance < totalCost) {
        await this.createLog(c, 'buyItem', 'inventory', 400, user.user_id, { itemId, reason: 'insufficient_balance', required: totalCost, available: user.balance });
        return this.sendError(c, 400, 'Insufficient balance');
      }
      if (!isOwner) {
        await this.userService.updateUserBalance(user.user_id, user.balance - totalCost);
        await this.userService.updateUserBalance(owner.user_id, owner.balance + totalCost * 0.75);
      }
      await this.inventoryService.addItem(user.user_id, itemId, amount, undefined, user.user_id != owner.user_id, item.price);
      await this.createLog(c, 'buyItem', 'inventory', 200, user.user_id, { itemId, amount, totalCost, isOwner, itemName: item.name });
      return c.json({ message: 'Item bought' });
    } catch (error) {
      await this.createLog(c, 'buyItem', 'inventory', 500, user.user_id, { itemId, amount, error: error instanceof Error ? error.message : String(error) });
      return this.sendError(c, 500, 'Error buying item');
    }
  }

  @httpPost('/sell/:itemId', LoggedCheck, sellItemRateLimit)
  public async sellItem(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) return this.sendError(c, 401, 'Unauthorized');
    const itemId = c.req.param('itemId');
    const { amount, purchasePrice, dataItemIndex } = await c.req.json();
    if (!itemId || isNaN(amount)) {
      await this.createLog(c, 'sellItem', 'inventory', 400, user.user_id, { reason: 'invalid_input', itemId, amount });
      return this.sendError(c, 400, 'Invalid input');
    }
    try {
      const item = await this.itemService.getItem(itemId);
      if (!item || item.deleted) {
        await this.createLog(c, 'sellItem', 'inventory', 404, user.user_id, { itemId });
        return this.sendError(c, 404, 'Item not found');
      }
      const repo = this.inventoryService.getInventoryRepository();
      const correctedUserId = await this.inventoryService.getCorrectedUserId(user.user_id);
      if (purchasePrice !== undefined) {
        const itemsWithPrice = (await repo.getInventory({ userId: correctedUserId, itemId, sellable: true, purchasePrice })).filter(invItem => invItem.purchasePrice === purchasePrice);
        const totalAvailable = itemsWithPrice.reduce((sum, item) => sum + item.amount, 0);
        if (totalAvailable < amount) {
          await this.createLog(c, 'sellItem', 'inventory', 400, user.user_id, { itemId, reason: 'insufficient_items_with_price', requested: amount, available: totalAvailable, purchasePrice });
          return this.sendError(c, 400, `Insufficient items with purchase price ${purchasePrice}. You have ${totalAvailable} but requested to sell ${amount}.`);
        }
        await repo.removeSellableItemWithPrice(correctedUserId, itemId, amount, purchasePrice, dataItemIndex);
        const sellValue = purchasePrice * amount * 0.75;
        const isOwner = user.user_id === item.owner;
        if (!isOwner) await this.userService.updateUserBalance(user.user_id, user.balance + sellValue);
        await this.createLog(c, 'sellItem', 'inventory', 200, user.user_id, { itemId, amount, purchasePrice, totalValue: sellValue, isOwner, itemName: item.name });
        return c.json({ message: 'Item sold', totalValue: Math.round(sellValue), itemsSold: amount });
      }
      const items = await repo.getInventory({ userId: correctedUserId, itemId, sellable: true });
      const totalAvailable = items.filter(i => !i.metadata).reduce((sum, i) => sum + i.amount, 0);
      if (totalAvailable < amount) {
        await this.createLog(c, 'sellItem', 'inventory', 400, user.user_id, { itemId, reason: 'insufficient_items', requested: amount, available: totalAvailable });
        return this.sendError(c, 400, `Insufficient items to sell. You have ${totalAvailable} but requested to sell ${amount}.`);
      }
      await repo.removeSellableItem(correctedUserId, itemId, amount);
      const sellValue = item.price * amount * 0.75;
      const isOwner = user.user_id === item.owner;
      if (!isOwner) await this.userService.updateUserBalance(user.user_id, user.balance + sellValue);
      await this.createLog(c, 'sellItem', 'inventory', 200, user.user_id, { itemId, amount, totalValue: sellValue, isOwner, itemName: item.name });
      return c.json({ message: 'Item sold', totalValue: Math.round(sellValue), itemsSold: amount });
    } catch (error) {
      await this.createLog(c, 'sellItem', 'inventory', 500, user.user_id, { itemId, amount, purchasePrice, error: error instanceof Error ? error.message : String(error) });
      return this.sendError(c, 500, 'Error selling item');
    }
  }

  @httpPost('/consume/:itemId', LoggedCheck, OwnerCheck)
  public async consumeItem(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) return this.sendError(c, 401, 'Unauthorized');
    const itemId = c.req.param('itemId');
    const { amount, uniqueId, userId } = await c.req.json();
    if (!itemId || !userId) {
      await this.createLog(c, 'consumeItem', 'inventory', 400, user.user_id, { reason: 'missing_required_fields', itemId, userId });
      return this.sendError(c, 400, 'Invalid input: itemId and userId are required');
    }
    if ((amount && uniqueId) || (!amount && !uniqueId)) {
      await this.createLog(c, 'consumeItem', 'inventory', 400, user.user_id, { reason: 'invalid_parameters', itemId, userId, hasAmount: !!amount, hasUniqueId: !!uniqueId });
      return this.sendError(c, 400, "Invalid input: provide either 'amount' for items without metadata OR 'uniqueId' for items with metadata");
    }
    if (amount && isNaN(amount)) {
      await this.createLog(c, 'consumeItem', 'inventory', 400, user.user_id, { reason: 'invalid_amount', itemId, userId, amount });
      return this.sendError(c, 400, 'Invalid input: amount must be a number');
    }
    try {
      const targetUser = await this.userService.getUser(userId);
      if (!targetUser) {
        await this.createLog(c, 'consumeItem', 'inventory', 404, user.user_id, { itemId, userId, reason: 'target_user_not_found' });
        return this.sendError(c, 404, 'Target user not found');
      }
      const item = await this.itemService.getItem(itemId);
      if (!item || item.deleted) {
        await this.createLog(c, 'consumeItem', 'inventory', 404, user.user_id, { itemId, userId });
        return this.sendError(c, 404, 'Item not found');
      }
      const repo = this.inventoryService.getInventoryRepository();
      const correctedUserId = await this.inventoryService.getCorrectedUserId(targetUser.user_id);
      if (uniqueId) {
        await repo.removeItemByUniqueId(correctedUserId, itemId, uniqueId);
        await this.createLog(c, 'consumeItem', 'inventory', 200, user.user_id, { itemId, userId, uniqueId, itemName: item.name });
        return c.json({ message: 'Item with metadata consumed' });
      } else {
        const hasEnoughItems = await repo.hasItemWithoutMetadataSellable(correctedUserId, itemId, amount);
        if (!hasEnoughItems) {
          await this.createLog(c, 'consumeItem', 'inventory', 400, user.user_id, { itemId, userId, amount, reason: 'insufficient_items' });
          return this.sendError(c, 400, "User doesn't have enough items without metadata");
        }
        await repo.removeItem(correctedUserId, itemId, amount);
        await this.createLog(c, 'consumeItem', 'inventory', 200, user.user_id, { itemId, amount, userId, itemName: item.name });
        return c.json({ message: 'Items without metadata consumed' });
      }
    } catch (error) {
      await this.createLog(c, 'consumeItem', 'inventory', 500, user.user_id, { itemId, amount, uniqueId, userId, error: error instanceof Error ? error.message : String(error) });
      return this.sendError(c, 500, 'Error consuming item');
    }
  }

  @httpPost('/drop/:itemId', LoggedCheck, dropItemRateLimit)
  public async dropItem(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) return this.sendError(c, 401, 'Unauthorized');
    const itemId = c.req.param('itemId');
    const { amount, uniqueId, dataItemIndex } = await c.req.json();
    if (!itemId) {
      await this.createLog(c, 'dropItem', 'inventory', 400, user.user_id, { reason: 'missing_itemId' });
      return this.sendError(c, 400, 'Invalid input: itemId is required');
    }
    if ((amount && uniqueId) || (!amount && !uniqueId)) {
      await this.createLog(c, 'dropItem', 'inventory', 400, user.user_id, { reason: 'invalid_parameters', itemId, hasAmount: !!amount, hasUniqueId: !!uniqueId });
      return this.sendError(c, 400, "Invalid input: provide either 'amount' for items without metadata OR 'uniqueId' for items with metadata");
    }
    if (amount && isNaN(amount)) {
      await this.createLog(c, 'dropItem', 'inventory', 400, user.user_id, { reason: 'invalid_amount', itemId, amount });
      return this.sendError(c, 400, 'Invalid input: amount must be a number');
    }
    try {
      const repo = this.inventoryService.getInventoryRepository();
      const correctedUserId = await this.inventoryService.getCorrectedUserId(user.user_id);
      if (uniqueId) {
        await repo.removeItemByUniqueId(correctedUserId, itemId, uniqueId);
        await this.createLog(c, 'dropItem', 'inventory', 200, user.user_id, { itemId, uniqueId });
        return c.json({ message: 'Item with metadata dropped' });
      } else {
        const hasEnoughItems = await repo.hasItemWithoutMetadata(correctedUserId, itemId, amount);
        if (!hasEnoughItems) {
          await this.createLog(c, 'dropItem', 'inventory', 400, user.user_id, { itemId, amount, reason: 'insufficient_items' });
          return this.sendError(c, 400, "You don't have enough items without metadata to drop");
        }
        await repo.removeItem(correctedUserId, itemId, amount, dataItemIndex);
        await this.createLog(c, 'dropItem', 'inventory', 200, user.user_id, { itemId, amount });
        return c.json({ message: 'Items without metadata dropped' });
      }
    } catch (error) {
      await this.createLog(c, 'dropItem', 'inventory', 500, user.user_id, { itemId, amount, uniqueId, error: error instanceof Error ? error.message : String(error) });
      return this.sendError(c, 500, 'Error dropping item');
    }
  }


  @httpPost('/transfer-ownership/:itemId', LoggedCheck, OwnerCheck, transferOwnershipRateLimit)
  public async transferOwnership(c: Context) {
    const user = this.getUserFromContext(c);
    if (!user) return this.sendError(c, 401, 'Unauthorized');
    const itemId = c.req.param('itemId');
    const { newOwnerId } = await c.req.json();
    if (!itemId || !newOwnerId) {
      await this.createLog(c, 'transferOwnership', 'items', 400, user.user_id, { reason: 'invalid_input', itemId, newOwnerId });
      return this.sendError(c, 400, 'Invalid input');
    }
    try {
      const item = await this.itemService.getItem(itemId);
      if (!item || item.deleted) {
        await this.createLog(c, 'transferOwnership', 'items', 404, user.user_id, { itemId });
        return this.sendError(c, 404, 'Item not found');
      }
      const newOwner = await this.userService.getUser(newOwnerId);
      if (!newOwner) {
        await this.createLog(c, 'transferOwnership', 'items', 404, user.user_id, { itemId, newOwnerId, reason: 'new_owner_not_found' });
        return this.sendError(c, 404, 'New owner not found');
      }
      await this.itemService.transferOwnership(itemId, newOwnerId);
      await this.createLog(c, 'transferOwnership', 'items', 200, user.user_id, { itemId, old_owner: item.owner, new_owner: newOwnerId, new_owner_username: newOwner.username, item_name: item.name });
      return c.json({ message: 'Ownership transferred' });
    } catch (error) {
      await this.createLog(c, 'transferOwnership', 'items', 500, user.user_id, { itemId, newOwnerId, error: error instanceof Error ? error.message : String(error) });
      return this.sendError(c, 500, 'Error transferring ownership');
    }
  }
}


