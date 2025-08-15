import { Request, Response } from "express";
import { inject } from "inversify";
import { controller, httpDelete, httpGet, httpPost, httpPut } from "inversify-express-utils";
import { IItemService } from "../services/ItemService";
import { createItemValidator, updateItemValidator, itemIdParamValidator } from "../validators/ItemValidator";
import { IInventoryService } from "../services/InventoryService";
import { IUserService } from "../services/UserService";
import { ILogService } from "../services/LogService";
import { AuthenticatedRequest, LoggedCheck } from "../middlewares/LoggedCheck";
import { AuthenticatedRequestWithOwner, OwnerCheck } from "../middlewares/OwnerCheck";
import { v4 } from "uuid";
import { describe } from "../decorators/describe";
import { ValidationError, Schema } from "yup";

function handleError(res: Response, error: unknown, message: string, status = 500) {
 const msg = error instanceof Error ? error.message : String(error);
 res.status(status).send({ message, error: msg });
}

async function validateOr400(schema: Schema<unknown>, data: unknown, res: Response, message = "Invalid data") {
 try {
  await schema.validate(data);
  return true;
 } catch (error) {
  if (error instanceof ValidationError) {
   res.status(400).send({ message, errors: error.errors });
   return false;
  }
  throw error;
 }
}

@controller("/items")
export class Items {
 constructor(
  @inject("ItemService") private itemService: IItemService,
  @inject("InventoryService") private inventoryService: IInventoryService,
  @inject("UserService") private userService: IUserService,
  @inject("LogService") private logService: ILogService
 ) {}

 // Helper pour les logs (uniformisé)
 private async createLog(req: Request, tableName: string, statusCode?: number, userId?: string, metadata?: object) {
  try {
   const requestBody = { ...req.body };
   if (metadata) requestBody.metadata = metadata;
   await this.logService.createLog({
    ip_address: (req.headers["x-real-ip"] as string) || (req.socket.remoteAddress as string),
    table_name: tableName,
    controller: "ItemController",
    original_path: req.originalUrl,
    http_method: req.method,
    request_body: requestBody,
    user_id: userId ?? ((req as AuthenticatedRequest).user?.user_id as string),
    status_code: statusCode,
   });
  } catch (error) {
   console.error("Failed to log action:", error);
  }
 }

 // --- LECTURE ---
 @describe({
  endpoint: "/items",
  method: "GET",
  description: "Get all non-deleted items visible in store",
  responseType: [
   {
    itemId: "string",
    name: "string",
    description: "string",
    owner: "string",
    price: "number",
    iconHash: "string",
   },
  ],
  example: "GET /api/items",
 })
 @httpGet("/")
 public async getAllItems(req: Request, res: Response) {
  try {
   const items = await this.itemService.getStoreItems();
   await this.createLog(req, "items", 200, undefined, { items_count: items.length });
   res.send(items);
  } catch (error) {
   await this.createLog(req, "items", 500, undefined, {
    error: error instanceof Error ? error.message : String(error),
   });
   handleError(res, error, "Error fetching items");
  }
 }

 @describe({
  endpoint: "/items/@mine",
  method: "GET",
  description: "Get all items owned by the authenticated user.",
  responseType: [
   {
    itemId: "string",
    name: "string",
    description: "string",
    owner: "string",
    price: "number",
    iconHash: "string",
    showInStore: "boolean",
   },
  ],
  example: "GET /api/items/@mine",
  requiresAuth: true,
 })
 @httpGet("/@mine", LoggedCheck.middleware)
 public async getMyItems(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.user_id;
  if (!userId) {
   await this.createLog(req, "items", 401);
   return res.status(401).send({ message: "Unauthorized" });
  }
  try {
   const items = await this.itemService.getMyItems(userId);
   await this.createLog(req, "items", 200, undefined, { owned_items_count: items.length });
   res.send(items);
  } catch (error) {
   await this.createLog(req, "items", 500, undefined, {
    error: error instanceof Error ? error.message : String(error),
   });
   handleError(res, error, "Error fetching your items");
  }
 }

 @describe({
  endpoint: "/items/search",
  method: "GET",
  description: "Search for items by name (only those visible in store)",
  query: { q: "The search query" },
  responseType: [
   {
    itemId: "string",
    name: "string",
    description: "string",
    owner: "string",
    price: "number",
    iconHash: "string",
    showInStore: "boolean",
   },
  ],
  example: "GET /api/items/search?q=Apple",
 })
 @httpGet("/search")
 public async searchItems(req: Request, res: Response) {
  const query = (req.query.q as string)?.trim();
  if (!query) {
   await this.createLog(req, "items", 400, undefined, { reason: "missing_search_query" });
   return res.status(400).send({ message: "Missing search query" });
  }
  try {
   const items = await this.itemService.searchItemsByName(query);
   await this.createLog(req, "items", 200, undefined, {
    search_query: query,
    results_count: items.length,
   });
   res.send(items);
  } catch (error) {
   await this.createLog(req, "items", 500, undefined, {
    search_query: query,
    error: error instanceof Error ? error.message : String(error),
   });
   handleError(res, error, "Error searching items");
  }
 }

 @describe({
  endpoint: "/items/:itemId",
  method: "GET",
  description: "Get a single item by itemId",
  params: { itemId: "The id of the item" },
  responseType: {
   itemId: "string",
   name: "string",
   description: "string",
   owner: "string",
   price: "number",
   showInStore: "boolean",
   iconHash: "string",
  },
  example: "GET /api/items/123",
 })
 @httpGet("/:itemId")
 public async getItem(req: Request, res: Response) {
  if (!(await validateOr400(itemIdParamValidator, req.params, res, "Invalid itemId"))) {
   await this.createLog(req, "items", 400);
   return;
  }
  try {
   const { itemId } = req.params;
   const item = await this.itemService.getItem(itemId);
   if (!item || item.deleted) {
    await this.createLog(req, "items", 404, undefined, { itemId });
    return res.status(404).send({ message: "Item not found" });
   }
   await this.createLog(req, "items", 200, undefined, {
    itemId,
    item_name: item.name,
    item_price: item.price,
   });
   res.send({
    itemId: item.itemId,
    name: item.name,
    description: item.description,
    owner: item.owner,
    price: item.price,
    iconHash: item.iconHash,
    showInStore: item.showInStore,
   });
  } catch (error) {
   await this.createLog(req, "items", 500, undefined, {
    itemId: req.params.itemId,
    error: error instanceof Error ? error.message : String(error),
   });
   handleError(res, error, "Error fetching item");
  }
 }

 // --- CREATION / MODIFICATION / SUPPRESSION ---
 @describe({
  endpoint: "/items/create",
  method: "POST",
  description: "Create a new item.",
  body: {
   name: "Name of the item",
   description: "Description of the item",
   price: "Price of the item",
   iconHash: "Hash of the icon (optional)",
   showInStore: "Show in store (optional, boolean)",
  },
  responseType: { message: "string" },
  example: 'POST /api/items/create {"name": "Apple", "description": "A fruit", "price": 100, "iconHash": "abc123", "showInStore": true}',
  requiresAuth: true,
 })
 @httpPost("/create", LoggedCheck.middleware)
 public async createItem(req: AuthenticatedRequest, res: Response) {
  if (!(await validateOr400(createItemValidator, req.body, res, "Invalid item data"))) {
   await this.createLog(req, "items", 400);
   return;
  }
  const itemId = v4();
  const { name, description, price, iconHash, showInStore } = req.body;
  try {
   await this.itemService.createItem({
    itemId,
    name: name ?? null,
    description: description ?? null,
    price: price ?? 0,
    owner: req.user.user_id,
    iconHash: iconHash ?? null,
    showInStore: showInStore ?? false,
    deleted: false,
   });
   await this.createLog(req, "items", 201, undefined, {
    itemId,
    item_name: name,
    item_price: price,
    show_in_store: showInStore,
   });
   res.status(200).send({ message: "Item created" });
  } catch (error) {
   await this.createLog(req, "items", 500, undefined, {
    item_name: name,
    error: error instanceof Error ? error.message : String(error),
   });
   handleError(res, error, "Error creating item");
  }
 }

 @describe({
  endpoint: "/items/update/:itemId",
  method: "PUT",
  description: "Update an existing item.",
  params: { itemId: "The id of the item" },
  body: {
   name: "Name of the item",
   description: "Description of the item",
   price: "Price of the item",
   iconHash: "Hash of the icon (optional)",
   showInStore: "Show in store (optional, boolean)",
  },
  responseType: { message: "string" },
  example: 'PUT /api/items/update/123 {"name": "Apple", "description": "A fruit", "price": 100, "iconHash": "abc123", "showInStore": true}',
  requiresAuth: true,
 })
 @httpPut("/update/:itemId", OwnerCheck.middleware)
 public async updateItem(req: AuthenticatedRequestWithOwner, res: Response) {
  if (!(await validateOr400(itemIdParamValidator, req.params, res, "Invalid itemId"))) {
   await this.createLog(req, "items", 400);
   return;
  }
  if (!(await validateOr400(updateItemValidator, req.body, res, "Invalid update data"))) {
   await this.createLog(req, "items", 400);
   return;
  }
  const { itemId } = req.params;
  const { name, description, price, iconHash, showInStore } = req.body;
  try {
   await this.itemService.updateItem(itemId, {
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description }),
    ...(price !== undefined && { price }),
    ...(iconHash !== undefined && { iconHash }),
    ...(showInStore !== undefined && { showInStore }),
   });
   await this.createLog(req, "items", 200, undefined, {
    itemId,
    updated_fields: {
     name: name !== undefined,
     description: description !== undefined,
     price: price !== undefined,
     iconHash: iconHash !== undefined,
     showInStore: showInStore !== undefined,
    },
   });
   res.status(200).send({ message: "Item updated" });
  } catch (error) {
   await this.createLog(req, "items", 500, undefined, {
    itemId,
    error: error instanceof Error ? error.message : String(error),
   });
   handleError(res, error, "Error updating item");
  }
 }

 @describe({
  endpoint: "/items/delete/:itemId",
  method: "DELETE",
  description: "Delete an item.",
  params: { itemId: "The id of the item" },
  responseType: { message: "string" },
  example: "DELETE /api/items/delete/123",
  requiresAuth: true,
 })
 @httpDelete("/delete/:itemId", OwnerCheck.middleware)
 public async deleteItem(req: AuthenticatedRequestWithOwner, res: Response) {
  if (!(await validateOr400(itemIdParamValidator, req.params, res, "Invalid itemId"))) {
   await this.createLog(req, "items", 400);
   return;
  }
  const { itemId } = req.params;
  try {
   await this.itemService.deleteItem(itemId);
   await this.createLog(req, "items", 200, undefined, { itemId, action: "deleted" });
   res.status(200).send({ message: "Item deleted" });
  } catch (error) {
   await this.createLog(req, "items", 500, undefined, {
    itemId,
    error: error instanceof Error ? error.message : String(error),
   });
   handleError(res, error, "Error deleting item");
  }
 }

 // --- ACTIONS INVENTAIRE ---
 @describe({
  endpoint: "/items/buy/:itemId",
  method: "POST",
  description: "Buy an item (without metadata only).",
  params: { itemId: "The id of the item" },
  body: {
   amount: "The amount of the item to buy",
  },
  responseType: { message: "string" },
  example: 'POST /api/items/buy/item_1 {"amount": 2}',
  requiresAuth: true,
 })
 @httpPost("/buy/:itemId", LoggedCheck.middleware)
 public async buyItem(req: AuthenticatedRequest, res: Response) {
  const { itemId } = req.params;
  const { amount } = req.body;
  if (!itemId || isNaN(amount)) {
   await this.createLog(req, "inventory", 400, req.user?.user_id, {
    reason: "invalid_input",
    itemId,
    amount,
   });
   return res.status(400).send({ message: "Invalid input" });
  }
  try {
   const item = await this.itemService.getItem(itemId);
   if (!item || item.deleted) {
    await this.createLog(req, "inventory", 404, req.user?.user_id, { itemId, action: "buy" });
    return res.status(404).send({ message: "Item not found" });
   }

   const user = req.user;
   const owner = await this.userService.getUser(item.owner);
   if (!user) {
    await this.createLog(req, "inventory", 404, req.user?.user_id, {
     itemId,
     action: "buy",
     reason: "user_not_found",
    });
    return res.status(404).send({ message: "User not found" });
   }
   if (!owner) {
    await this.createLog(req, "inventory", 404, req.user?.user_id, {
     itemId,
     action: "buy",
     reason: "owner_not_found",
    });
    return res.status(404).send({ message: "Owner not found" });
   }

   const totalCost = item.price * amount;
   const isOwner = user.user_id === item.owner;

   if (!isOwner && user.balance < totalCost) {
    await this.createLog(req, "inventory", 400, req.user?.user_id, {
     itemId,
     action: "buy",
     reason: "insufficient_balance",
     required: totalCost,
     available: user.balance,
    });
    return res.status(400).send({ message: "Insufficient balance" });
   }

   if (!isOwner) {
    await this.userService.updateUserBalance(user.user_id, user.balance - totalCost);
    await this.userService.updateUserBalance(owner.user_id, owner.balance + totalCost * 0.75);
   }

   // Ajouter l'item SANS métadonnées avec sellable = true car acheté
   await this.inventoryService.addItem(user.user_id, itemId, amount, undefined, req.user.user_id != owner.user_id, item.price);

   await this.createLog(req, "inventory", 200, req.user?.user_id, {
    itemId,
    action: "buy",
    amount,
    total_cost: totalCost,
    is_owner: isOwner,
    item_name: item.name,
   });
   res.status(200).send({ message: "Item bought" });
  } catch (error) {
   const errorMsg = error instanceof Error ? error.message : String(error);
   await this.createLog(req, "inventory", 500, req.user?.user_id, {
    itemId,
    action: "buy",
    amount,
    error: errorMsg,
   });
   console.error("Error buying item", error);
   res.status(500).send({ message: "Error buying item", error: errorMsg });
  }
 }

 @describe({
  endpoint: "/items/sell/:itemId",
  method: "POST",
  description: "Sell an item (without metadata only).",
  params: { itemId: "The id of the item" },
  body: { amount: "The amount of the item to sell" },
  responseType: { message: "string" },
  example: 'POST /api/items/sell/item_1 {"amount": 1}',
  requiresAuth: true,
 })
 @httpPost("/sell/:itemId", LoggedCheck.middleware)
 public async sellItem(req: AuthenticatedRequest, res: Response) {
  const { itemId } = req.params;
  const { amount, purchasePrice } = req.body; // Ajouter purchasePrice
  if (!itemId || isNaN(amount)) {
   await this.createLog(req, "inventory", 400, req.user?.user_id, {
    reason: "invalid_input",
    itemId,
    amount,
   });
   return res.status(400).send({ message: "Invalid input" });
  }
  try {
   const item = await this.itemService.getItem(itemId);
   if (!item || item.deleted) {
    await this.createLog(req, "inventory", 404, req.user?.user_id, { itemId, action: "sell" });
    return res.status(404).send({ message: "Item not found" });
   }

   const user = req.user;
   if (!user) {
    await this.createLog(req, "inventory", 404, req.user?.user_id, {
     itemId,
     action: "sell",
     reason: "user_not_found",
    });
    return res.status(404).send({ message: "User not found" });
   }

   // Si un prix d'achat spécifique est fourni, utiliser removeSellableItemWithPrice
   if (purchasePrice !== undefined) {
    // Vérifier que l'utilisateur a suffisamment d'items avec ce prix d'achat
    const inventory = await this.inventoryService.getInventory(user.user_id);
    const itemsWithPrice = inventory.inventory.filter((invItem) => invItem.item_id === itemId && invItem.sellable && invItem.purchasePrice === purchasePrice);

    const totalAvailable = itemsWithPrice.reduce((sum, item) => sum + item.amount, 0);

    if (totalAvailable < amount) {
     await this.createLog(req, "inventory", 400, req.user?.user_id, {
      itemId,
      action: "sell",
      reason: "insufficient_items_with_price",
      requested: amount,
      available: totalAvailable,
      purchasePrice,
     });
     return res.status(400).send({
      message: `Insufficient items with purchase price ${purchasePrice}. You have ${totalAvailable} but requested to sell ${amount}.`,
     });
    }

    // Supprimer les items avec le prix d'achat spécifique
    await this.inventoryService.removeSellableItemWithPrice(user.user_id, itemId, amount, purchasePrice);

    const sellValue = purchasePrice * amount * 0.75; // 75% du prix d'achat
    const isOwner = user.user_id === item.owner;

    // Augmenter le balance seulement si l'utilisateur n'est PAS le propriétaire
    if (!isOwner) {
     await this.userService.updateUserBalance(user.user_id, user.balance + sellValue);
    }

    await this.createLog(req, "inventory", 200, req.user?.user_id, {
     itemId,
     action: "sell",
     amount,
     purchasePrice,
     total_value: sellValue,
     is_owner: isOwner,
     item_name: item.name,
    });

    res.status(200).send({
     message: "Item sold",
     totalValue: Math.round(sellValue),
     itemsSold: amount,
    });
    return;
   }

   // Logique existante pour la vente sans prix spécifique
   // (le reste du code existant...)
  } catch (error) {
   const errorMsg = error instanceof Error ? error.message : String(error);
   await this.createLog(req, "inventory", 500, req.user?.user_id, {
    itemId,
    action: "sell",
    amount,
    purchasePrice,
    error: errorMsg,
   });
   console.error("Error selling item", error);
   res.status(500).send({ message: "Error selling item", error: errorMsg });
  }
 }

 @describe({
  endpoint: "/items/give/:itemId",
  method: "POST",
  description: "Give item occurrences to a user (owner only).",
  params: { itemId: "The id of the item" },
  body: {
   amount: "The amount of the item to give",
   metadata: "Optional metadata for the item (object)",
   userId: "The id of the user to give the item to",
  },
  responseType: { message: "string" },
  example: `POST /api/items/give/item_1 {"amount": 1, "metadata": {"key": "value", "rarity"?: 'very-common' | 'common' | 'uncommon' | 'rare' | 'very-rare' | 'epic' | 'ultra-epic' | 'legendary' | 'ancient' | 'mythic' | 'godlike' | 'radiant', "custom_url_link"?: "http://example.com/item_1.png"}, "userId": "user_2"}`,
  requiresAuth: true,
 })
 @httpPost("/give/:itemId", OwnerCheck.middleware)
 public async giveItem(req: AuthenticatedRequestWithOwner, res: Response) {
  const { itemId } = req.params;
  const { amount, metadata, userId } = req.body;
  if (!itemId || isNaN(amount) || !userId) {
   await this.createLog(req, "inventory", 400, req.user?.user_id, {
    reason: "invalid_input",
    itemId,
    amount,
    userId,
   });
   return res.status(400).send({ message: "Invalid input" });
  }
  try {
   const targetUser = await this.userService.getUser(userId);
   if (!targetUser) {
    await this.createLog(req, "inventory", 404, req.user?.user_id, {
     itemId,
     action: "give",
     userId,
     reason: "target_user_not_found",
    });
    return res.status(404).send({ message: "Target user not found" });
   }

   // Vérifier que l'item existe
   const item = await this.itemService.getItem(itemId);
   if (!item || item.deleted) {
    await this.createLog(req, "inventory", 404, req.user?.user_id, {
     itemId,
     action: "give",
     userId,
    });
    return res.status(404).send({ message: "Item not found" });
   }

   // Donner l'item à l'utilisateur cible avec sellable = false car donné par owner
   await this.inventoryService.addItem(targetUser.user_id, itemId, amount, metadata, false);

   await this.createLog(req, "inventory", 200, req.user?.user_id, {
    itemId,
    action: "give",
    amount,
    target_user_id: userId,
    target_username: targetUser.username,
    has_metadata: !!metadata,
    item_name: item.name,
   });
   res.status(200).send({ message: "Item given" });
  } catch (error) {
   const errorMsg = error instanceof Error ? error.message : String(error);
   await this.createLog(req, "inventory", 500, req.user?.user_id, {
    itemId,
    action: "give",
    amount,
    userId,
    error: errorMsg,
   });
   console.error("Error giving item", error);
   res.status(500).send({ message: "Error giving item", error: errorMsg });
  }
 }

 @describe({
  endpoint: "/items/consume/:itemId",
  method: "POST",
  description: "Consume item occurrences from a user (owner only).",
  params: { itemId: "The id of the item" },
  body: {
   amount: "The amount of the item to consume (for items without metadata)",
   uniqueId: "The unique ID of the item instance (for items with metadata)",
   userId: "The id of the user to consume the item from",
  },
  responseType: { message: "string" },
  example: 'POST /api/items/consume/item_1 {"amount": 1, "userId": "user_2"} OR {"uniqueId": "abc-123", "userId": "user_2"}',
  requiresAuth: true,
 })
 @httpPost("/consume/:itemId", OwnerCheck.middleware)
 public async consumeItem(req: AuthenticatedRequestWithOwner, res: Response) {
  const { itemId } = req.params;
  const { amount, uniqueId, userId } = req.body;

  if (!itemId || !userId) {
   await this.createLog(req, "inventory", 400, req.user?.user_id, {
    reason: "missing_required_fields",
    itemId,
    userId,
   });
   return res.status(400).send({ message: "Invalid input: itemId and userId are required" });
  }

  // Vérifier qu'on a soit amount soit uniqueId, mais pas les deux
  if ((amount && uniqueId) || (!amount && !uniqueId)) {
   await this.createLog(req, "inventory", 400, req.user?.user_id, {
    reason: "invalid_parameters",
    itemId,
    userId,
    has_amount: !!amount,
    has_uniqueId: !!uniqueId,
   });
   return res.status(400).send({
    message: "Invalid input: provide either 'amount' for items without metadata OR 'uniqueId' for items with metadata",
   });
  }

  if (amount && isNaN(amount)) {
   await this.createLog(req, "inventory", 400, req.user?.user_id, {
    reason: "invalid_amount",
    itemId,
    userId,
    amount,
   });
   return res.status(400).send({ message: "Invalid input: amount must be a number" });
  }

  try {
   const targetUser = await this.userService.getUser(userId);
   if (!targetUser) {
    await this.createLog(req, "inventory", 404, req.user?.user_id, {
     itemId,
     action: "consume",
     userId,
     reason: "target_user_not_found",
    });
    return res.status(404).send({ message: "Target user not found" });
   }

   // Vérifier que l'item existe
   const item = await this.itemService.getItem(itemId);
   if (!item || item.deleted) {
    await this.createLog(req, "inventory", 404, req.user?.user_id, {
     itemId,
     action: "consume",
     userId,
    });
    return res.status(404).send({ message: "Item not found" });
   }

   if (uniqueId) {
    // Consommer un item spécifique avec métadonnées
    await this.inventoryService.removeItemByUniqueId(targetUser.user_id, itemId, uniqueId);
    await this.createLog(req, "inventory", 200, req.user?.user_id, {
     itemId,
     action: "consume",
     target_user_id: userId,
     target_username: targetUser.username,
     uniqueId,
     item_name: item.name,
    });
    res.status(200).send({ message: "Item with metadata consumed" });
   } else {
    // Consommer des items sans métadonnées
    const hasEnoughItems = await this.inventoryService.hasItemWithoutMetadataSellable(targetUser.user_id, itemId, amount);

    if (!hasEnoughItems) {
     await this.createLog(req, "inventory", 400, req.user?.user_id, {
      itemId,
      action: "consume",
      userId,
      amount,
      reason: "insufficient_items",
     });
     return res.status(400).send({
      message: "User doesn't have enough items without metadata",
     });
    }

    await this.inventoryService.removeItem(targetUser.user_id, itemId, amount);
    await this.createLog(req, "inventory", 200, req.user?.user_id, {
     itemId,
     action: "consume",
     amount,
     target_user_id: userId,
     target_username: targetUser.username,
     item_name: item.name,
    });
    res.status(200).send({ message: "Items without metadata consumed" });
   }
  } catch (error) {
   const errorMsg = error instanceof Error ? error.message : String(error);
   await this.createLog(req, "inventory", 500, req.user?.user_id, {
    itemId,
    action: "consume",
    amount,
    uniqueId,
    userId,
    error: errorMsg,
   });
   console.error("Error consuming item", error);
   res.status(500).send({ message: "Error consuming item", error: errorMsg });
  }
 }

 @describe({
  endpoint: "/items/update-metadata/:itemId",
  method: "PUT",
  description: "Update metadata for a specific item instance in inventory.",
  params: { itemId: "The id of the item" },
  body: {
   uniqueId: "The unique ID of the item instance",
   metadata: "Metadata object to update",
  },
  responseType: { message: "string" },
  example: 'PUT /api/items/update-metadata/item_1 {"uniqueId": "abc-123", "metadata": {"level": 5, "enchantment": "fire"}}',
  requiresAuth: true,
 })
 @httpPut("/update-metadata/:itemId", LoggedCheck.middleware)
 public async updateItemMetadata(req: AuthenticatedRequest, res: Response) {
  const { itemId } = req.params;
  const { uniqueId, metadata } = req.body;

  if (!itemId || !uniqueId || !metadata || typeof metadata !== "object") {
   await this.createLog(req, "inventory", 400, req.user?.user_id, {
    reason: "invalid_input",
    itemId,
    uniqueId,
    has_metadata: !!metadata,
   });
   return res.status(400).send({ message: "Invalid input" });
  }

  try {
   const user = req.user;
   if (!user) {
    await this.createLog(req, "inventory", 404, req.user?.user_id, {
     itemId,
     action: "update_metadata",
     reason: "user_not_found",
    });
    return res.status(404).send({ message: "User not found" });
   }

   await this.inventoryService.updateItemMetadata(user.user_id, itemId, uniqueId, metadata);
   await this.createLog(req, "inventory", 200, req.user?.user_id, {
    itemId,
    action: "update_metadata",
    uniqueId,
    metadata_keys: Object.keys(metadata),
   });
   res.status(200).send({ message: "Item metadata updated" });
  } catch (error) {
   await this.createLog(req, "inventory", 500, req.user?.user_id, {
    itemId,
    action: "update_metadata",
    uniqueId,
    error: error instanceof Error ? error.message : String(error),
   });
   handleError(res, error, "Error updating item metadata");
  }
 }

 @describe({
  endpoint: "/items/drop/:itemId",
  method: "POST",
  description: "Drop item occurrences from your inventory.",
  params: { itemId: "The id of the item" },
  body: {
   amount: "The amount of the item to drop (for items without metadata)",
   uniqueId: "The unique ID of the item instance to drop (for items with metadata)",
  },
  responseType: { message: "string" },
  example: 'POST /api/items/drop/item_1 {"amount": 1} OR {"uniqueId": "abc-123"}',
  requiresAuth: true,
 })
 @httpPost("/drop/:itemId", LoggedCheck.middleware)
 public async dropItem(req: AuthenticatedRequest, res: Response) {
  const { itemId } = req.params;
  const { amount, uniqueId } = req.body;

  if (!itemId) {
   await this.createLog(req, "inventory", 400, req.user?.user_id, {
    reason: "missing_itemId",
   });
   return res.status(400).send({ message: "Invalid input: itemId is required" });
  }

  // Vérifier qu'on a soit amount soit uniqueId, mais pas les deux
  if ((amount && uniqueId) || (!amount && !uniqueId)) {
   await this.createLog(req, "inventory", 400, req.user?.user_id, {
    reason: "invalid_parameters",
    itemId,
    has_amount: !!amount,
    has_uniqueId: !!uniqueId,
   });
   return res.status(400).send({
    message: "Invalid input: provide either 'amount' for items without metadata OR 'uniqueId' for items with metadata",
   });
  }

  if (amount && isNaN(amount)) {
   await this.createLog(req, "inventory", 400, req.user?.user_id, {
    reason: "invalid_amount",
    itemId,
    amount,
   });
   return res.status(400).send({ message: "Invalid input: amount must be a number" });
  }

  try {
   const user = req.user;
   if (!user) {
    await this.createLog(req, "inventory", 404, req.user?.user_id, {
     itemId,
     action: "drop",
     reason: "user_not_found",
    });
    return res.status(404).send({ message: "User not found" });
   }

   if (uniqueId) {
    // Supprimer un item spécifique avec métadonnées
    await this.inventoryService.removeItemByUniqueId(user.user_id, itemId, uniqueId);
    await this.createLog(req, "inventory", 200, req.user?.user_id, {
     itemId,
     action: "drop",
     uniqueId,
    });
    res.status(200).send({ message: "Item with metadata dropped" });
   } else {
    // Supprimer des items sans métadonnées
    const hasEnoughItems = await this.inventoryService.hasItemWithoutMetadata(user.user_id, itemId, amount);

    if (!hasEnoughItems) {
     await this.createLog(req, "inventory", 400, req.user?.user_id, {
      itemId,
      action: "drop",
      amount,
      reason: "insufficient_items",
     });
     return res.status(400).send({
      message: "You don't have enough items without metadata to drop",
     });
    }

    await this.inventoryService.removeItem(user.user_id, itemId, amount);
    await this.createLog(req, "inventory", 200, req.user?.user_id, {
     itemId,
     action: "drop",
     amount,
    });
    res.status(200).send({ message: "Items without metadata dropped" });
   }
  } catch (error) {
   const errorMsg = error instanceof Error ? error.message : String(error);
   await this.createLog(req, "inventory", 500, req.user?.user_id, {
    itemId,
    action: "drop",
    amount,
    uniqueId,
    error: errorMsg,
   });
   console.error("Error dropping item", error);
   res.status(500).send({ message: "Error dropping item", error: errorMsg });
  }
 }

 @httpPost("/transfer-ownership/:itemId", OwnerCheck.middleware)
 public async transferOwnership(req: AuthenticatedRequestWithOwner, res: Response) {
  const { itemId } = req.params;
  const { newOwnerId } = req.body;
  if (!itemId || !newOwnerId) {
   await this.createLog(req, "items", 400, req.user?.user_id, {
    reason: "invalid_input",
    itemId,
    newOwnerId,
   });
   return res.status(400).send({ message: "Invalid input" });
  }
  try {
   const item = await this.itemService.getItem(itemId);
   if (!item || item.deleted) {
    await this.createLog(req, "items", 404, req.user?.user_id, {
     itemId,
     action: "transfer_ownership",
    });
    return res.status(404).send({ message: "Item not found" });
   }
   const newOwner = await this.userService.getUser(newOwnerId);
   if (!newOwner) {
    await this.createLog(req, "items", 404, req.user?.user_id, {
     itemId,
     action: "transfer_ownership",
     newOwnerId,
     reason: "new_owner_not_found",
    });
    return res.status(404).send({ message: "New owner not found" });
   }
   await this.itemService.transferOwnership(itemId, newOwnerId);
   await this.createLog(req, "items", 200, req.user?.user_id, {
    itemId,
    action: "transfer_ownership",
    old_owner: item.owner,
    new_owner: newOwnerId,
    new_owner_username: newOwner.username,
    item_name: item.name,
   });
   res.status(200).send({ message: "Ownership transferred" });
  } catch (error) {
   await this.createLog(req, "items", 500, req.user?.user_id, {
    itemId,
    action: "transfer_ownership",
    newOwnerId,
    error: error instanceof Error ? error.message : String(error),
   });
   handleError(res, error, "Error transferring ownership");
  }
 }
}
