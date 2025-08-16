import { Request, Response } from "express";
import { inject } from "inversify";
import { controller, httpGet } from "inversify-express-utils";
import { IInventoryService } from "../services/InventoryService";
import { userIdParamSchema } from "../validators/InventoryValidator";
import { describe } from "../decorators/describe";
import { AuthenticatedRequest, LoggedCheck } from "../middlewares/LoggedCheck";
import { ValidationError, Schema } from "yup";
import { ILogService } from "../services/LogService";

// --- UTILS ---
function handleError(res: Response, error: unknown, message: string, status = 500) {
	const msg = error instanceof Error ? error.message : String(error);
	res.status(status).send({ message, error: msg });
}

async function validateOr400(schema: Schema<unknown>, data: unknown, res: Response) {
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

@controller("/inventory")
export class Inventories {
	constructor(
		@inject("InventoryService") private inventoryService: IInventoryService,
		@inject("LogService") private logService: ILogService
	) { }

	// Helper pour créer des logs (signature uniforme)
	private async createLog(req: Request, action: string, tableName?: string, statusCode?: number, userId?: string) {
		try {
			await this.logService.createLog({
				ip_address: (req.headers["x-real-ip"] as string) || (req.socket.remoteAddress as string),
				table_name: tableName,
				controller: `InventoryController.${action}`,
				original_path: req.originalUrl,
				http_method: req.method,
				request_body: req.body,
				user_id: userId,
				status_code: statusCode,
			});
		} catch (error) {
			console.error("Error creating log:", error);
		}
	}

	// --- Inventaire de l'utilisateur courant ---
	@describe({
		endpoint: "/inventory/@me",
		method: "GET",
		description: "Get the inventory of the authenticated user with all item instances and item details",
		responseType: {
			user_id: "string",
			inventory: [
				{
					user_id: "string",
					item_id: "string",
					amount: "number",
					metadata: "object (optional, includes _unique_id for unique items)",
					sellable: "boolean",
					purchasePrice: "number (optional, price at which the item was purchased)",
					itemId: "string",
					name: "string",
					description: "string",
					iconHash: "string",
					price: "number",
					owner: "string",
					showInStore: "boolean",
				},
			],
		},
		example: "GET /api/inventory/@me",
		requiresAuth: true,
	})
	@httpGet("/@me", LoggedCheck.middleware)
	public async getMyInventory(req: AuthenticatedRequest, res: Response) {
		const userId = req.user.user_id;
		try {
			const inventory = await this.inventoryService.getInventory(userId);
			await this.createLog(req, "getMyInventory", "inventory", 200, userId);
			res.send(inventory);
		} catch (error) {
			await this.createLog(req, "getMyInventory", "inventory", 500, userId);
			handleError(res, error, "Error fetching inventory");
		}
	}

	// --- Inventaire d'un utilisateur spécifique ---
	@describe({
		endpoint: "/inventory/:userId",
		method: "GET",
		description: "Get the inventory of a user with all item instances and item details",
		params: { userId: "The id of the user" },
		responseType: {
			user_id: "string",
			inventory: [
				{
					user_id: "string",
					item_id: "string",
					amount: "number",
					metadata: "object (optional, includes _unique_id for unique items)",
					sellable: "boolean",
					purchasePrice: "number (optional, price at which the item was purchased)",
					itemId: "string",
					name: "string",
					description: "string",
					iconHash: "string",
					price: "number",
					owner: "string",
					showInStore: "boolean",
				},
			],
		},
		example: "GET /api/inventory/123",
	})
	@httpGet("/:userId")
	public async getInventory(req: Request, res: Response) {
		if (!(await validateOr400(userIdParamSchema, { userId: req.params.userId }, res))) {
			await this.createLog(req, "getInventory", "inventory", 400, req.params.userId);
			return;
		}
		const userId = req.params.userId;
		try {
			const inventory = await this.inventoryService.getInventory(userId);
			await this.createLog(req, "getInventory", "inventory", 200, userId);
			res.send(inventory);
		} catch (error) {
			await this.createLog(req, "getInventory", "inventory", 500, userId);
			handleError(res, error, "Error fetching inventory");
		}
	}

	// --- Route générique (prompt) ---
	@httpGet("/")
	public async getAllInventories(req: Request, res: Response) {
		await this.createLog(req, "getAllInventories", "inventory", 400);
		res.send({ message: "Please specify /api/inventory/<userId>" });
	}
}
