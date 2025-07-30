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
import { AuthenticatedRequest, LoggedCheck } from "../middlewares/LoggedCheck";

@controller("/gifts")
export class GameGifts {
    constructor(
        @inject("GameGiftService") private giftService: IGameGiftService,
        @inject("GameService") private gameService: IGameService,
        @inject("UserService") private userService: IUserService
    ) { }

    @httpPost("/create", LoggedCheck.middleware)
    public async createGift(req: AuthenticatedRequest, res: Response) {
        const { gameId, message } = req.body;
        const userId = req.user.user_id;

        if (!gameId) {
            return res.status(400).send({ message: "Game ID is required" });
        }

        try {
            // Vérifier que le jeu existe
            const game = await this.gameService.getGame(gameId);
            if (!game) {
                return res.status(404).send({ message: "Game not found" });
            }

            // Vérifier le solde de l'utilisateur
            const user = await this.userService.getUser(userId);
            if (!user) {
                return res.status(404).send({ message: "User not found" });
            }

            if (user.balance < game.price) {
                return res.status(400).send({
                    message: `Insufficient balance. Required: ${game.price}, Available: ${user.balance}`
                });
            }

            // Ne pas débiter ni créditer si l'utilisateur est le propriétaire du jeu
            if (userId !== game.owner_id) {
                // Débiter le montant du compte de l'utilisateur
                await this.userService.updateUserBalance(userId, user.balance - game.price);

                // Créditer le propriétaire du jeu (75% du prix)
                const owner = await this.userService.getUser(game.owner_id);
                if (owner) {
                    await this.userService.updateUserBalance(game.owner_id, owner.balance + game.price * 0.75);
                }
            }

            // Créer le gift
            const gift = await this.giftService.createGift(gameId, userId, message);

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
            const msg = error instanceof Error ? error.message : String(error);
            res.status(500).send({ message: "Error creating gift", error: msg });
        }
    }

    @httpPost("/claim", LoggedCheck.middleware)
    public async claimGift(req: AuthenticatedRequest, res: Response) {
        const { giftCode } = req.body;
        const userId = req.user.user_id;

        if (!giftCode) {
            return res.status(400).send({ message: "Gift code is required" });
        }

        try {
            // Vérifier que le gift existe
            const gift = await this.giftService.getGift(giftCode);
            if (!gift) {
                return res.status(404).send({ message: "Invalid gift code" });
            }

            // Vérifier que l'utilisateur ne possède pas déjà le jeu
            const userOwnsGame = await this.gameService.userOwnsGame(gift.gameId, userId);
            if (userOwnsGame) {
                return res.status(400).send({ message: "You already own this game" });
            }

            // Réclamer le gift
            const claimedGift = await this.giftService.claimGift(giftCode, userId);

            // Ajouter le jeu à la bibliothèque de l'utilisateur
            await this.gameService.addOwner(gift.gameId, userId);

            res.status(200).send({
                message: "Gift claimed successfully",
                gift: claimedGift
            });
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            res.status(400).send({ message: msg });
        }
    }

    @httpGet("/sent", LoggedCheck.middleware)
    public async getSentGifts(req: AuthenticatedRequest, res: Response) {
        try {
            const gifts = await this.giftService.getUserSentGifts(req.user.user_id);

            // Enrichir avec les informations des jeux
            const enrichedGifts = await Promise.all(
                gifts.map(async (gift) => {
                    const game = await this.gameService.getGameForPublic(gift.gameId);
                    return {
                        ...gift,
                        game
                    };
                })
            );

            res.send(enrichedGifts);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            res.status(500).send({ message: "Error fetching sent gifts", error: msg });
        }
    }

    @httpGet("/received", LoggedCheck.middleware)
    public async getReceivedGifts(req: AuthenticatedRequest, res: Response) {
        try {
            const gifts = await this.giftService.getUserReceivedGifts(req.user.user_id);

            // Enrichir avec les informations des jeux et utilisateurs
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

            res.send(enrichedGifts);
        } catch (error) {
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
                return res.status(404).send({ message: "Gift not found" });
            }

            const game = await this.gameService.getGameForPublic(gift.gameId);
            const fromUser = await this.userService.getUser(gift.fromUserId);

            // Vérifier si l'utilisateur actuel possède déjà le jeu
            const userOwnsGame = await this.gameService.userOwnsGame(gift.gameId, req.user.user_id);

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
            const msg = error instanceof Error ? error.message : String(error);
            res.status(500).send({ message: "Error fetching gift info", error: msg });
        }
    }

    @httpDelete("/:giftId", LoggedCheck.middleware)
    public async revokeGift(req: AuthenticatedRequest, res: Response) {
        const { giftId } = req.params;
        const userId = req.user.user_id;

        try {
            // Récupérer les infos du gift avant de le révoquer
            const gifts = await this.giftService.getUserSentGifts(userId);
            const gift = gifts.find(g => g.id === giftId);

            if (!gift) {
                return res.status(404).send({ message: "Gift not found" });
            }

            if (!gift.isActive) {
                return res.status(400).send({ message: "Gift is no longer active" });
            }

            // Révoquer le gift
            await this.giftService.revokeGift(giftId, userId);

            // Rembourser l'utilisateur
            const game = await this.gameService.getGame(gift.gameId);
            if (game) {
                const user = await this.userService.getUser(userId);
                if (user) {
                    await this.userService.updateUserBalance(userId, user.balance + game.price);
                }

                // Débiter le propriétaire du jeu (75% du prix)
                const owner = await this.userService.getUser(game.owner_id);
                if (owner) {
                    await this.userService.updateUserBalance(game.owner_id, owner.balance - game.price * 0.75);
                }
            }

            res.send({ message: "Gift revoked successfully and refund processed" });
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            res.status(400).send({ message: msg });
        }
    }
}