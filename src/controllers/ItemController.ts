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
    description: "Buy an item.",
    params: { itemId: "The id of the item" },
    body: { amount: "The amount of the item to buy" },
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

      // Only check and update balance if the user is NOT the owner
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
      // If user is owner, skip balance check and update

      const currentAmount = await this.inventoryService.getItemAmount(
        user.user_id,
        itemId
      );
      if (currentAmount) {
        await this.inventoryService.setItemAmount(
          user.user_id,
          itemId,
          currentAmount + amount
        );
      } else {
        await this.inventoryService.addItem(user.user_id, itemId, amount);
      }

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
    description: "Sell an item.",
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

      // Only increase balance if the user is NOT the owner
      if (user.user_id !== item.owner) {
        await this.userService.updateUserBalance(
          user.user_id,
          user.balance + item.price * amount * 0.75
        );
      }
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
    body: { amount: "The amount of the item to give" },
    responseType: { message: "string" },
    example: 'POST /api/items/give/item_1 {"amount": 1}',
    requiresAuth: true,
  })
  @httpPost("/give/:itemId", OwnerCheck.middleware)
  public async giveItem(req: AuthenticatedRequestWithOwner, res: Response) {
    const { itemId } = req.params;
    const { amount } = req.body;
    if (!itemId || isNaN(amount)) {
      return res.status(400).send({ message: "Invalid input" });
    }
    try {
      const user = req?.user;
      if (!user) {
        return res.status(404).send({ message: "User not found" });
      }

      const currentAmount = await this.inventoryService.getItemAmount(
        user.user_id,
        itemId
      );
      if (currentAmount) {
        await this.inventoryService.setItemAmount(
          user.user_id,
          itemId,
          currentAmount + amount
        );
      } else {
        await this.inventoryService.addItem(user.user_id, itemId, amount);
      }

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
    body: { amount: "The amount of the item to consume" },
    responseType: { message: "string" },
    example: 'POST /api/items/consume/item_1 {"amount": 1}',
    requiresAuth: true,
  })
  @httpPost("/consume/:itemId", OwnerCheck.middleware)
  public async consumeItem(req: AuthenticatedRequestWithOwner, res: Response) {
    const { itemId } = req.params;
    const { amount } = req.body;
    if (!itemId || isNaN(amount)) {
      return res.status(400).send({ message: "Invalid input" });
    }
    try {
      const user = req?.user;
      if (!user) {
        return res.status(404).send({ message: "User not found" });
      }

      await this.inventoryService.removeItem(user.user_id, itemId, amount);

      res.status(200).send({ message: "Item consumed" });
    } catch (error) {
      console.error("Error consuming item", error);
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).send({ message: "Error consuming item", error: message });
    }
  }

  @describe({
    endpoint: "/items/drop/:itemId",
    method: "POST",
    description: "Drop item occurrences from your inventory.",
    params: { itemId: "The id of the item" },
    body: { amount: "The amount of the item to drop" },
    responseType: { message: "string" },
    example: 'POST /api/items/drop/item_1 {"amount": 1}',
    requiresAuth: true,
  })
  @httpPost("/drop/:itemId", LoggedCheck.middleware)
  public async dropItem(req: AuthenticatedRequest, res: Response) {
    const { itemId } = req.params;
    const { amount } = req.body;
    if (!itemId || isNaN(amount)) {
      return res.status(400).send({ message: "Invalid input" });
    }
    try {
      const user = req.user;
      if (!user) {
        return res.status(404).send({ message: "User not found" });
      }
      await this.inventoryService.removeItem(user.user_id, itemId, amount);
      res.status(200).send({ message: "Item dropped" });
    } catch (error) {
      console.error("Error dropping item", error);
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).send({ message: "Error dropping item", error: message });
    }
  }

  @describe({
    endpoint: "/items/transfer/:itemId",
    method: "POST",
    description: "Transfer item occurrences to another user.",
    params: { itemId: "The id of the item" },
    body: {
      amount: "The amount of the item to transfer",
      targetUserId: "The user ID of the recipient",
    },
    responseType: { message: "string" },
    example:
      'POST /api/items/transfer/item_1 {"amount": 1, "targetUserId": "user_2"}',
    requiresAuth: true,
  })
  @httpPost("/transfer/:itemId", LoggedCheck.middleware)
  public async transferItem(req: AuthenticatedRequest, res: Response) {
    const { itemId } = req.params;
    const { amount, targetUserId } = req.body;
    if (!itemId || isNaN(amount) || amount <= 0 || !targetUserId) {
      return res.status(400).send({ message: "Invalid input" });
    }
    try {
      const user = req.user;
      if (!user) {
        return res.status(404).send({ message: "User not found" });
      }
      if (user.user_id === targetUserId) {
        return res.status(400).send({ message: "Cannot transfer to yourself" });
      }

      // Check sender inventory
      const senderAmount = await this.inventoryService.getItemAmount(
        user.user_id,
        itemId
      );
      if (!senderAmount || senderAmount < amount) {
        return res
          .status(400)
          .send({ message: "Not enough items to transfer" });
      }

      // Remove from sender
      await this.inventoryService.removeItem(user.user_id, itemId, amount);

      // Add to recipient
      const recipientAmount = await this.inventoryService.getItemAmount(
        targetUserId,
        itemId
      );
      if (recipientAmount) {
        await this.inventoryService.setItemAmount(
          targetUserId,
          itemId,
          recipientAmount + Number(amount)
        );
      } else {
        await this.inventoryService.addItem(
          targetUserId,
          itemId,
          Number(amount)
        );
      }

      res.status(200).send({ message: "Item transferred" });
    } catch (error) {
      console.error("Error transferring item", error);
      const message = error instanceof Error ? error.message : String(error);
      res
        .status(500)
        .send({ message: "Error transferring item", error: message });
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
