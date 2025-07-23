import { Request, Response } from "express";
import { inject } from "inversify";
import { controller, httpGet } from "inversify-express-utils";
import { IInventoryService } from "../services/InventoryService";
import { IItemService } from "../services/ItemService";
import { userIdParamSchema } from "../validators/InventoryValidator";
import { describe } from "../decorators/describe";
import { AuthenticatedRequest, LoggedCheck } from "../middlewares/LoggedCheck";

// --- UTILS ---
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
  res: Response
) {
  try {
    await schema.validate(data);
    return true;
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).send({
        message: "Validation failed",
        errors: error.errors,
      });
      return false;
    }
    throw error;
  }
}

async function formatInventory(
  inventory: Array<{ item_id: string; amount: number }>,
  itemService: IItemService
) {
  const seen = new Set<string>();
  return (
    await Promise.all(
      inventory
        .filter((item) => {
          if (seen.has(item.item_id)) return false;
          seen.add(item.item_id);
          return true;
        })
        .map(async (item) => {
          const itemDetails = await itemService.getItem(item.item_id);
          if (!itemDetails || itemDetails.deleted) return null;
          return {
            itemId: itemDetails.itemId,
            name: itemDetails.name,
            description: itemDetails.description,
            amount: item.amount,
            iconHash: itemDetails.iconHash,
          };
        })
    )
  ).filter(Boolean);
}

@controller("/inventory")
export class Inventories {
  constructor(
    @inject("InventoryService") private inventoryService: IInventoryService,
    @inject("ItemService") private itemService: IItemService
  ) {}

  // --- Inventaire de l'utilisateur courant ---
  @describe({
    endpoint: "/inventory/",
    method: "GET",
    description: "Prompt to specify a userId for inventory lookup",
    responseType: [
      {
        itemId: "string",
        name: "string",
        description: "string",
        amount: "number",
      },
    ],
    example: "GET /api/inventory/",
  })
  @httpGet("/@me", LoggedCheck.middleware)
  public async getMyInventory(req: AuthenticatedRequest, res: Response) {
    const userId = req.user.user_id; // Assuming you have middleware that sets req.userId
    try {
      const { inventory } = await this.inventoryService.getInventory(userId);
      res.send(await formatInventory(inventory, this.itemService));
    } catch (error) {
      handleError(res, error, "Error fetching inventory");
    }
  }

  // --- Inventaire d'un utilisateur spécifique ---
  @describe({
    endpoint: "/inventory/:userId",
    method: "GET",
    description: "Get the inventory of a user",
    params: { userId: "The id of the user" },
    responseType: [
      {
        itemId: "string",
        name: "string",
        description: "string",
        amount: "number",
      },
    ],
    example: "GET /api/inventory/123",
  })
  @httpGet("/:userId")
  public async getInventory(req: Request, res: Response) {
    if (!(await validateOr400(userIdParamSchema, { userId: req.params.userId }, res)))
      return;
    const userId = req.params.userId;
    try {
      const { inventory } = await this.inventoryService.getInventory(userId);
      res.send(await formatInventory(inventory, this.itemService));
    } catch (error) {
      handleError(res, error, "Error fetching inventory");
    }
  }

  // --- Route générique (prompt) ---
  @httpGet("/")
  public async getAllInventories(req: Request, res: Response) {
    res.send({ message: "Please specify /api/inventory/<userId>" });
  }
}
