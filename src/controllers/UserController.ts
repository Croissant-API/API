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
export class UserController {
    constructor(
        @inject("UserService") private userService: IUserService,
    ) {}

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
        const filteredUser = {
            userId: user.user_id,
            balance: user.balance,
            username: user.username,
            verificationKey: genVerificationKey(user.user_id)
        };
        res.send(filteredUser);
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
        const filteredUser = {
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


    @httpGet("/search", LoggedCheck.middleware)
    public async searchUsers(req: AuthenticatedRequest, res: Response) {
        const query = (req.query.q as string)?.trim();
        if (!query) {
            return res.status(400).send({ message: "Missing search query" });
        }
        try {
            const users: User[] = await this.userService.searchUsersByUsername(query);
            const filtered = users.map(user => ({
                userId: user.user_id,
                username: user.username,
                balance: user.balance,
            }));
            res.send(filtered);
        } catch (error) {
            console.error("Error searching users", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error searching users", error: message });
        }
    }

    // @httpDelete("/delete/:userId")
    // public async deleteUser(req: Request, res: Response) {
    //     try {
    //         await userIdParamValidator.validate(req.params);
    //     } catch (err) {
    //         return res.status(400).send({ message: "Invalid userId", error: err });
    //     }
    //     const { userId } = req.params;
    //     try {
    //         await this.userService.deleteUser(userId);
    //         res.status(200).send({ message: "User deleted" });
    //     } catch (error) {
    //         console.error("Error deleting user", error);
    //         const message = (error instanceof Error) ? error.message : String(error);
    //         res.status(500).send({ message: "Error deleting user", error: message });
    //     }
    // }
}
