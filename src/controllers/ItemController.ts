import { Request, Response } from "express";
import { inject } from "inversify";
import {
  controller,
  httpDelete,
  httpGet,
  httpPost,
  httpPut,
} from "inversify-express-utils";
import { IItemService } from "../services/ItemService";
import {
  createItemValidator,
  updateItemValidator,
  itemIdParamValidator,
} from "../validators/ItemValidator";
import { IInventoryService } from "../services/InventoryService";
import { IUserService } from "../services/UserService";
import { AuthenticatedRequest, LoggedCheck } from "../middlewares/LoggedCheck";
import {
  AuthenticatedRequestWithOwner,
  OwnerCheck,
} from "../middlewares/OwnerCheck";
import { v4 } from "uuid";
import { describe } from "../decorators/describe";
import { ValidationError, Schema } from "yup";

function handleError(
  res: Response,
  error: unknown,
  message: string,
  status = 500
) {
  const msg = error instanceof Error ? error.message : String(error);
  res.status(status).send({ message, error: msg });
}

async function validateOr400(
  schema: Schema<unknown>,
  data: unknown,
  res: Response,
  message = "Invalid data"
) {
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
    @inject("UserService") private userService: IUserService
  ) {}

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
      res.send(items);
    } catch (error) {
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
    if (!userId) return res.status(401).send({ message: "Unauthorized" });
    try {
      const items = await this.itemService.getMyItems(userId);
      res.send(items);
    } catch (error) {
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
    if (!query) return res.status(400).send({ message: "Missing search query" });
    try {
      const items = await this.itemService.searchItemsByName(query);
      res.send(items);
    } catch (error) {
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
  @httpGet(":itemId")
  public async getItem(req: Request, res: Response) {
    if (!(await validateOr400(itemIdParamValidator, req.params, res, "Invalid itemId")))
      return;
    try {
      const { itemId } = req.params;
      const item = await this.itemService.getItem(itemId);
      if (!item || item.deleted)
        return res.status(404).send({ message: "Item not found" });
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
    example:
      'POST /api/items/create {"name": "Apple", "description": "A fruit", "price": 100, "iconHash": "abc123", "showInStore": true}',
    requiresAuth: true,
  })
  @httpPost("/create", LoggedCheck.middleware)
  public async createItem(req: AuthenticatedRequest, res: Response) {
    if (!(await validateOr400(createItemValidator, req.body, res, "Invalid item data")))
      return;
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
      res.status(200).send({ message: "Item created" });
    } catch (error) {
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
    example:
      'PUT /api/items/update/123 {"name": "Apple", "description": "A fruit", "price": 100, "iconHash": "abc123", "showInStore": true}',
    requiresAuth: true,
  })
  @httpPut("/update/:itemId", OwnerCheck.middleware)
  public async updateItem(req: AuthenticatedRequestWithOwner, res: Response) {
    if (!(await validateOr400(itemIdParamValidator, req.params, res, "Invalid itemId")))
      return;
    if (!(await validateOr400(updateItemValidator, req.body, res, "Invalid update data")))
      return;
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
      res.status(200).send({ message: "Item updated" });
    } catch (error) {
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
    if (!(await validateOr400(itemIdParamValidator, req.params, res, "Invalid itemId")))
      return;
    const { itemId } = req.params;
    try {
      await this.itemService.deleteItem(itemId);
      res.status(200).send({ message: "Item deleted" });
    } catch (error) {
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
      amount: "The amount of the item to buy"
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
      return res.status(400).send({ message: "Invalid input" });
    }
    try {
      const item = await this.itemService.getItem(itemId);
      if (!item || item.deleted) {
        return res.status(404).send({ message: "Item not found" });
      }

      const user = req.user;
      const owner = await this.userService.getUser(item.owner);
      if (!user) {
        return res.status(404).send({ message: "User not found" });
      }
      if (!owner) {
        return res.status(404).send({ message: "Owner not found" });
      }

      if (user.user_id !== item.owner) {
        if (user.balance < item.price * amount) {
          return res.status(400).send({ message: "Insufficient balance" });
        }
        await this.userService.updateUserBalance(
          user.user_id,
          user.balance - item.price * amount
        );
        await this.userService.updateUserBalance(
          owner.user_id,
          owner.balance + item.price * amount * 0.75
        );
      }

      // Ajouter l'item SANS métadonnées (les utilisateurs ne peuvent pas acheter d'items avec métadonnées)
      await this.inventoryService.addItem(user.user_id, itemId, amount);

      res.status(200).send({ message: "Item bought" });
    } catch (error) {
      console.error("Error buying item", error);
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).send({ message: "Error buying item", error: message });
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
    const { amount } = req.body;
    if (!itemId || isNaN(amount)) {
      return res.status(400).send({ message: "Invalid input" });
    }
    try {
      const item = await this.itemService.getItem(itemId);
      if (!item || item.deleted) {
        return res.status(404).send({ message: "Item not found" });
      }

      const user = req.user;
      if (!user) {
        return res.status(404).send({ message: "User not found" });
      }

      // Vérifier que l'utilisateur a suffisamment d'items SANS métadonnées
      const inventory = await this.inventoryService.getInventory(user.user_id);
      const itemsWithoutMetadata = inventory.inventory.filter(
        invItem => invItem.item_id === itemId && !invItem.metadata
      );
      const totalAmountWithoutMetadata = itemsWithoutMetadata.reduce(
        (sum, invItem) => sum + invItem.amount, 0
      );

      if (totalAmountWithoutMetadata < amount) {
        return res.status(400).send({ 
          message: "Insufficient items without metadata. You can only sell items without metadata." 
        });
      }

      // Only increase balance if the user is NOT the owner
      if (user.user_id !== item.owner) {
        await this.userService.updateUserBalance(
          user.user_id,
          user.balance + item.price * amount * 0.75
        );
      }
      
      // Supprimer les items (cela supprimera d'abord les items sans métadonnées)
      await this.inventoryService.removeItem(user.user_id, itemId, amount);

      res.status(200).send({ message: "Item sold" });
    } catch (error) {
      console.error("Error selling item", error);
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).send({ message: "Error selling item", error: message });
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
      userId: "The id of the user to give the item to"
    },
    responseType: { message: "string" },
    example: 'POST /api/items/give/item_1 {"amount": 1, "metadata": {"rarity": "legendary"}, "userId": "user_2"}',
    requiresAuth: true,
  })
  @httpPost("/give/:itemId", OwnerCheck.middleware)
  public async giveItem(req: AuthenticatedRequestWithOwner, res: Response) {
    const { itemId } = req.params;
    const { amount, metadata, userId } = req.body;
    if (!itemId || isNaN(amount) || !userId) {
      return res.status(400).send({ message: "Invalid input" });
    }
    try {
      const targetUser = await this.userService.getUser(userId);
      if (!targetUser) {
        return res.status(404).send({ message: "Target user not found" });
      }

      // Vérifier que l'item existe
      const item = await this.itemService.getItem(itemId);
      if (!item || item.deleted) {
        return res.status(404).send({ message: "Item not found" });
      }

      // Donner l'item à l'utilisateur cible
      await this.inventoryService.addItem(targetUser.user_id, itemId, amount, metadata);

      res.status(200).send({ message: "Item given" });
    } catch (error) {
      console.error("Error giving item", error);
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).send({ message: "Error giving item", error: message });
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
      userId: "The id of the user to consume the item from"
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
      return res.status(400).send({ message: "Invalid input: itemId and userId are required" });
    }

    // Vérifier qu'on a soit amount soit uniqueId, mais pas les deux
    if ((amount && uniqueId) || (!amount && !uniqueId)) {
      return res.status(400).send({ 
        message: "Invalid input: provide either 'amount' for items without metadata OR 'uniqueId' for items with metadata" 
      });
    }

    if (amount && isNaN(amount)) {
      return res.status(400).send({ message: "Invalid input: amount must be a number" });
    }

    try {
      const targetUser = await this.userService.getUser(userId);
      if (!targetUser) {
        return res.status(404).send({ message: "Target user not found" });
      }

      // Vérifier que l'item existe
      const item = await this.itemService.getItem(itemId);
      if (!item || item.deleted) {
        return res.status(404).send({ message: "Item not found" });
      }

      if (uniqueId) {
        // Consommer un item spécifique avec métadonnées
        await this.inventoryService.removeItemByUniqueId(targetUser.user_id, itemId, uniqueId);
        res.status(200).send({ message: "Item with metadata consumed" });
      } else {
        // Consommer des items sans métadonnées
        const hasEnoughItems = await this.inventoryService.hasItemWithoutMetadata(
          targetUser.user_id, 
          itemId, 
          amount
        );
        
        if (!hasEnoughItems) {
          return res.status(400).send({ 
            message: "User doesn't have enough items without metadata" 
          });
        }

        await this.inventoryService.removeItem(targetUser.user_id, itemId, amount);
        res.status(200).send({ message: "Items without metadata consumed" });
      }
    } catch (error) {
      console.error("Error consuming item", error);
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).send({ message: "Error consuming item", error: message });
    }
  }

  @describe({
    endpoint: "/items/update-metadata/:itemId",
    method: "PUT",
    description: "Update metadata for a specific item instance in inventory.",
    params: { itemId: "The id of the item" },
    body: { 
      uniqueId: "The unique ID of the item instance",
      metadata: "Metadata object to update" 
    },
    responseType: { message: "string" },
    example: 'PUT /api/items/update-metadata/item_1 {"uniqueId": "abc-123", "metadata": {"level": 5, "enchantment": "fire"}}',
    requiresAuth: true,
  })
  @httpPut("/update-metadata/:itemId", LoggedCheck.middleware)
  public async updateItemMetadata(req: AuthenticatedRequest, res: Response) {
    const { itemId } = req.params;
    const { uniqueId, metadata } = req.body;
    
    if (!itemId || !uniqueId || !metadata || typeof metadata !== 'object') {
      return res.status(400).send({ message: "Invalid input" });
    }
    
    try {
      const user = req.user;
      if (!user) {
        return res.status(404).send({ message: "User not found" });
      }

      await this.inventoryService.updateItemMetadata(user.user_id, itemId, uniqueId, metadata);
      res.status(200).send({ message: "Item metadata updated" });
    } catch (error) {
      handleError(res, error, "Error updating item metadata");
    }
  }

  @httpPost("/transfer-ownership/:itemId", OwnerCheck.middleware)
  public async transferOwnership(req: AuthenticatedRequestWithOwner, res: Response) {
    const { itemId } = req.params;
    const { newOwnerId } = req.body;
    if (!itemId || !newOwnerId) {
      return res.status(400).send({ message: "Invalid input" });
    }
    try {
      const item = await this.itemService.getItem(itemId);
      if (!item || item.deleted) {
        return res.status(404).send({ message: "Item not found" });
      }
      const newOwner = await this.userService.getUser(newOwnerId);
      if (!newOwner) {
        return res.status(404).send({ message: "New owner not found" });
      }
      await this.itemService.transferOwnership(itemId, newOwnerId);
      res.status(200).send({ message: "Ownership transferred" });
    } catch (error) {
      handleError(res, error, "Error transferring ownership");
    }
  }
}
