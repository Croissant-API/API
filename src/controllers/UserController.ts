import { Request, Response } from 'express';
import { inject } from 'inversify';
import { controller, httpGet, httpPost } from "inversify-express-utils";
import { IUserService } from '../services/UserService';
import { createUserValidator, userIdParamValidator } from '../validators/UserValidator';
import { describe } from '../decorators/describe';
import { AuthenticatedRequest, LoggedCheck } from '../middlewares/LoggedCheck';
import { genVerificationKey } from '../utils/GenKey';
import { User } from '../interfaces/User';

@controller("/users")
export class Users {
    constructor(
        @inject("UserService") private userService: IUserService,
    ) {}

    @describe({
        endpoint: "/users/",
        method: "POST",
        description: "Ajouter un nouvel utilisateur",
        body: { userId: "ID de l'utilisateur", username: "Nom d'utilisateur", balance: "Solde initial" },
        responseType: "object{message: string}",
        example: "POST /api/users/ { userId: '123', username: 'Jean', balance: 100 }"
    })
    @httpPost("/", LoggedCheck.middleware)
    public async addUser(req: AuthenticatedRequest, res: Response) {
        try {
            await createUserValidator.validate(req.body);
        } catch (err) {
            return res.status(400).send({ message: "Invalid user data", error: err });
        }
        const { userId, username, balance } = req.body;
        try {
            await this.userService.createUser(userId, username, balance);
            res.status(201).send({ message: "User added" });
        } catch (error) {
            console.error("Error adding user", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error adding user", error: message });
        }
    }


    @describe({
        endpoint: "/users/@me",
        method: "GET",
        description: "Get the authenticated user's information",
        responseType: "object{userId: string, balance: number, username: string}",
        example: "GET /api/users/@me"
    })
    @httpGet("/@me", LoggedCheck.middleware)
    async getMe(req: AuthenticatedRequest, res: Response) {
        const userId = req.user?.user_id;
        if (!userId) {
            return res.status(401).send({ message: "Unauthorized" });
        }
        const user = await this.userService.getUser(userId);
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }
        // Filter user to only expose allowed fields
        const discordUser = await this.userService.getDiscordUser(user.user_id)
        const filteredUser = {
            ...discordUser,
            userId: user.user_id,
            balance: user.balance,
            username: user.username,
            verificationKey: genVerificationKey(user.user_id)
        };
        res.send(filteredUser);
    }

    @describe({
        endpoint: "/users/search",
        method: "GET",
        description: "Search for users by username",
        query: { q: "The search query" },
        responseType: "array[object{userId: string, balance: number, username: string}]",
        example: "GET /api/users/search?q=John"
    })
    @httpGet("/search", LoggedCheck.middleware)
    public async searchUsers(req: AuthenticatedRequest, res: Response) {
        const query = (req.query.q as string)?.trim();
        if (!query) {
            return res.status(400).send({ message: "Missing search query" });
        }
        try {
            const users: User[] = await this.userService.searchUsersByUsername(query);

            const filtered = [];
            for (const user of users) {
                const discordUser = await this.userService.getDiscordUser(user.user_id);
                filtered.push({
                    ...discordUser,
                    userId: user.user_id,
                    username: user.username,
                    balance: user.balance,
                });
            }
            res.send(filtered);
        } catch (error) {
            console.error("Error searching users", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error searching users", error: message });
        }
    }

    @describe({
        endpoint: "/users/auth-verification",
        method: "GET",
        description: "Check the verification key for the user",
        responseType: "object{success: boolean}",
        query: { userId: "The id of the user", verificationKey: "The verification key" },
        example: "GET /api/users/auth-verification?userId=123&verificationKey=abc123"
    })
    @httpPost("/auth-verification")
    async checkVerificationKey(req: Request, res: Response) {
        const { userId, verificationKey } = req.query as { userId: string, verificationKey: string };
        if (!userId || !verificationKey) {
            return res.status(400).send({ message: "Missing userId or verificationKey" });
        }
        const user = await this.userService.getUser(userId);
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }
        const expectedKey = genVerificationKey(user.user_id);
        res.send({ success: verificationKey !== expectedKey });
    }


    @describe({
        endpoint: "/users/:userId",
        method: "GET",
        description: "Get a user by userId",
        params: { userId: "The id of the user" },
        responseType: "object{userId: string, balance: number, username: string}",
        example: "GET /api/users/123"
    })
    @httpGet("/:userId")
    public async getUser(req: Request, res: Response) {
        try {
            await userIdParamValidator.validate(req.params);
        } catch (err) {
            return res.status(400).send({ message: "Invalid userId", error: err });
        }
        const { userId } = req.params;
        const user = await this.userService.getUser(userId);
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }
        // Filter user to only expose allowed fields
        const discordUser = await this.userService.getDiscordUser(user.user_id)
        const filteredUser = {
            ...discordUser,
            userId: user.user_id,
            balance: user.balance,
            username: user.username,
        };
        res.send(filteredUser);
    }

    @httpPost("/create")
    public async createUser(req: Request, res: Response) {
        try {
            await createUserValidator.validate(req.body);
        } catch (err) {
            return res.status(400).send({ message: "Invalid user data", error: err });
        }
        const { userId, username, balance } = req.body;
        try {
            await this.userService.createUser(userId, username, balance);
            res.status(201).send({ message: "User created" });
        } catch (error) {
            console.error("Error creating user", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error creating user", error: message });
        }
    }

    @describe({
        endpoint: "/users/transfer-credits",
        method: "POST",
        description: "Transfer credits from one user to another",
        body: { targetUserId: "The id of the recipient", amount: "The amount to transfer" },
        responseType: "object{message: string}",
        example: "POST /api/users/transfer-credits { targetUserId: '456', amount: 50 }"
    })
    @httpPost("/transfer-credits", LoggedCheck.middleware)
    public async transferCredits(req: AuthenticatedRequest, res: Response) {
        const { targetUserId, amount } = req.body;
        if (!targetUserId || isNaN(amount) || amount <= 0) {
            return res.status(400).send({ message: "Invalid input" });
        }
        try {
            const sender = req.user;
            if (!sender) {
                return res.status(401).send({ message: "Unauthorized" });
            }
            if (sender.user_id === targetUserId) {
                return res.status(400).send({ message: "Cannot transfer credits to yourself" });
            }
            const recipient = await this.userService.getUser(targetUserId);
            if (!recipient) {
                return res.status(404).send({ message: "Recipient not found" });
            }
            if (sender.balance < amount) {
                return res.status(400).send({ message: "Insufficient balance" });
            }

            await this.userService.updateUserBalance(sender.user_id, sender.balance - Number(amount));
            await this.userService.updateUserBalance(recipient.user_id, recipient.balance + Number(amount));

            res.status(200).send({ message: "Credits transferred" });
        } catch (error) {
            console.error("Error transferring credits", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error transferring credits", error: message });
        }
    }
}
