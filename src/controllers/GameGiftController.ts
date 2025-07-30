import { Response } from "express";
import { inject } from "inversify";
import {
    controller,
    httpGet,
    httpPost,
    httpDelete,
} from "inversify-express-utils";
import { IGameGiftService } from "../services/GameGiftService";
import { IGameService } from "../services/GameService";
import { IUserService } from "../services/UserService";
import { ILogService } from "../services/LogService";
import { AuthenticatedRequest, LoggedCheck } from "../middlewares/LoggedCheck";

@controller("/gifts")
export class GameGifts {
    constructor(
        @inject("GameGiftService") private giftService: IGameGiftService,
        @inject("GameService") private gameService: IGameService,
        @inject("UserService") private userService: IUserService,
        @inject("LogService") private logService: ILogService
    ) { }

    // Helper pour créer des logs
    private async createLog(req: AuthenticatedRequest, controller: string, tableName?: string, statusCode?: number, userId?: string) {
        try {
            await this.logService.createLog({
                ip_address: req.headers["x-real-ip"] as string || req.socket.remoteAddress as string,
                table_name: tableName,
                controller: `GameGiftController.${controller}`,
                original_path: req.originalUrl,
                http_method: req.method,
                request_body: req.body,
                user_id: userId,
                status_code: statusCode
            });
        } catch (error) {
            console.error('Error creating log:', error);
        }
    }

    @httpPost("/create", LoggedCheck.middleware)
    public async createGift(req: AuthenticatedRequest, res: Response) {
        const { gameId, message } = req.body;
        const userId = req.user.user_id;

        if (!gameId) {
            await this.createLog(req, 'createGift', 'gifts', 400, userId);
            return res.status(400).send({ message: "Game ID is required" });
        }

        try {
            const game = await this.gameService.getGame(gameId);
            if (!game) {
                await this.createLog(req, 'createGift', 'gifts', 404, userId);
                return res.status(404).send({ message: "Game not found" });
            }

            const user = await this.userService.getUser(userId);
            if (!user) {
                await this.createLog(req, 'createGift', 'gifts', 404, userId);
                return res.status(404).send({ message: "User not found" });
            }

            if (user.balance < game.price) {
                await this.createLog(req, 'createGift', 'gifts', 400, userId);
                return res.status(400).send({
                    message: `Insufficient balance. Required: ${game.price}, Available: ${user.balance}`
                });
            }

            if (userId !== game.owner_id) {
                await this.userService.updateUserBalance(userId, user.balance - game.price);
                const owner = await this.userService.getUser(game.owner_id);
                if (owner) {
                    await this.userService.updateUserBalance(game.owner_id, owner.balance + game.price * 0.75);
                }
            }

            const gift = await this.giftService.createGift(gameId, userId, message);
            await this.createLog(req, 'createGift', 'gifts', 201, userId);

            res.status(201).send({
                message: "Gift created successfully",
                gift: {
                    id: gift.id,
                    gameId: gift.gameId,
                    giftCode: gift.giftCode,
                    createdAt: gift.createdAt,
                    message: gift.message
                }
            });
        } catch (error) {
            await this.createLog(req, 'createGift', 'gifts', 500, userId);
            const msg = error instanceof Error ? error.message : String(error);
            res.status(500).send({ message: "Error creating gift", error: msg });
        }
    }

    @httpPost("/claim", LoggedCheck.middleware)
    public async claimGift(req: AuthenticatedRequest, res: Response) {
        const { giftCode } = req.body;
        const userId = req.user.user_id;

        if (!giftCode) {
            await this.createLog(req, 'claimGift', 'gifts', 400, userId);
            return res.status(400).send({ message: "Gift code is required" });
        }

        try {
            const gift = await this.giftService.getGift(giftCode);
            if (!gift) {
                await this.createLog(req, 'claimGift', 'gifts', 404, userId);
                return res.status(404).send({ message: "Invalid gift code" });
            }

            const userOwnsGame = await this.gameService.userOwnsGame(gift.gameId, userId);
            if (userOwnsGame) {
                await this.createLog(req, 'claimGift', 'gifts', 400, userId);
                return res.status(400).send({ message: "You already own this game" });
            }

            const claimedGift = await this.giftService.claimGift(giftCode, userId);
            await this.gameService.addOwner(gift.gameId, userId);
            await this.createLog(req, 'claimGift', 'gifts', 200, userId);

            res.status(200).send({
                message: "Gift claimed successfully",
                gift: claimedGift
            });
        } catch (error) {
            await this.createLog(req, 'claimGift', 'gifts', 400, userId);
            const msg = error instanceof Error ? error.message : String(error);
            res.status(400).send({ message: msg });
        }
    }

    @httpGet("/sent", LoggedCheck.middleware)
    public async getSentGifts(req: AuthenticatedRequest, res: Response) {
        try {
            const gifts = await this.giftService.getUserSentGifts(req.user.user_id);

            const enrichedGifts = await Promise.all(
                gifts.map(async (gift) => {
                    const game = await this.gameService.getGameForPublic(gift.gameId);
                    return {
                        ...gift,
                        game
                    };
                })
            );

            await this.createLog(req, 'getSentGifts', 'gifts', 200, req.user.user_id);
            res.send(enrichedGifts);
        } catch (error) {
            await this.createLog(req, 'getSentGifts', 'gifts', 500, req.user.user_id);
            const msg = error instanceof Error ? error.message : String(error);
            res.status(500).send({ message: "Error fetching sent gifts", error: msg });
        }
    }

    @httpGet("/received", LoggedCheck.middleware)
    public async getReceivedGifts(req: AuthenticatedRequest, res: Response) {
        try {
            const gifts = await this.giftService.getUserReceivedGifts(req.user.user_id);

            const enrichedGifts = await Promise.all(
                gifts.map(async (gift) => {
                    const game = await this.gameService.getGameForPublic(gift.gameId);
                    const fromUser = await this.userService.getUser(gift.fromUserId);
                    return {
                        ...gift,
                        game,
                        fromUser: fromUser ? { id: fromUser.user_id, username: fromUser.username } : null
                    };
                })
            );

            await this.createLog(req, 'getReceivedGifts', 'gifts', 200, req.user.user_id);
            res.send(enrichedGifts);
        } catch (error) {
            await this.createLog(req, 'getReceivedGifts', 'gifts', 500, req.user.user_id);
            const msg = error instanceof Error ? error.message : String(error);
            res.status(500).send({ message: "Error fetching received gifts", error: msg });
        }
    }

    @httpGet("/:giftCode", LoggedCheck.middleware)
    public async getGiftInfo(req: AuthenticatedRequest, res: Response) {
        const { giftCode } = req.params;

        try {
            const gift = await this.giftService.getGift(giftCode);
            if (!gift) {
                await this.createLog(req, 'getGiftInfo', 'gifts', 404, req.user.user_id);
                return res.status(404).send({ message: "Gift not found" });
            }

            const game = await this.gameService.getGameForPublic(gift.gameId);
            const fromUser = await this.userService.getUser(gift.fromUserId);
            const userOwnsGame = await this.gameService.userOwnsGame(gift.gameId, req.user.user_id);

            await this.createLog(req, 'getGiftInfo', 'gifts', 200, req.user.user_id);
            res.send({
                gift: {
                    gameId: gift.gameId,
                    giftCode: gift.giftCode,
                    createdAt: gift.createdAt,
                    claimedAt: gift.claimedAt,
                    isActive: gift.isActive,
                    message: gift.message
                },
                game,
                fromUser: fromUser ? { id: fromUser.user_id, username: fromUser.username } : null,
                userOwnsGame
            });
        } catch (error) {
            await this.createLog(req, 'getGiftInfo', 'gifts', 500, req.user.user_id);
            const msg = error instanceof Error ? error.message : String(error);
            res.status(500).send({ message: "Error fetching gift info", error: msg });
        }
    }

    @httpDelete("/:giftId", LoggedCheck.middleware)
    public async revokeGift(req: AuthenticatedRequest, res: Response) {
        const { giftId } = req.params;
        const userId = req.user.user_id;

        try {
            const gifts = await this.giftService.getUserSentGifts(userId);
            const gift = gifts.find(g => g.id === giftId);

            if (!gift) {
                await this.createLog(req, 'revokeGift', 'gifts', 404, userId);
                return res.status(404).send({ message: "Gift not found" });
            }

            if (!gift.isActive) {
                await this.createLog(req, 'revokeGift', 'gifts', 400, userId);
                return res.status(400).send({ message: "Gift is no longer active" });
            }

            await this.giftService.revokeGift(giftId, userId);

            const game = await this.gameService.getGame(gift.gameId);
            if (game) {
                const user = await this.userService.getUser(userId);
                if (user) {
                    await this.userService.updateUserBalance(userId, user.balance + game.price);
                }

                const owner = await this.userService.getUser(game.owner_id);
                if (owner) {
                    await this.userService.updateUserBalance(game.owner_id, owner.balance - game.price * 0.75);
                }
            }

            await this.createLog(req, 'revokeGift', 'gifts', 200, userId);
            res.send({ message: "Gift revoked successfully and refund processed" });
        } catch (error) {
            await this.createLog(req, 'revokeGift', 'gifts', 400, userId);
            const msg = error instanceof Error ? error.message : String(error);
            res.status(400).send({ message: msg });
        }
    }
}