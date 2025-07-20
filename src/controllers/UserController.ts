import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { inject } from 'inversify';
import { controller, httpGet, httpPost } from "inversify-express-utils";
import { IUserService } from '../services/UserService';
import { userIdParamValidator } from '../validators/UserValidator';
import { describe } from '../decorators/describe';
import { AuthenticatedRequest, LoggedCheck } from '../middlewares/LoggedCheck';
import { genKey, genVerificationKey } from '../utils/GenKey';
import { User } from '../interfaces/User';

@controller("/users")
export class Users {
    constructor(
        @inject("UserService") private userService: IUserService,
    ) {}

    @describe({
        endpoint: "/users/@me",
        method: "GET",
        description: "Get the authenticated user's information",
        responseType: { userId: "string", balance: "number", username: "string" },
        example: "GET /api/users/@me",
        requiresAuth: true
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
            id: user.user_id,
            userId: user.user_id,
            email: user.email,
            balance: Math.floor(user.balance),
            username: user.username,
            verificationKey: genVerificationKey(user.user_id)
        };
        if(user.admin) {
            filteredUser.admin = user.admin;
        }
        res.send(filteredUser);
    }

    @describe({
        endpoint: "/users/search",
        method: "GET",
        description: "Search for users by username",
        query: { q: "The search query" },
        responseType: [{ userId: "string", balance: "number", username: "string" }],
        example: "GET /api/users/search?q=John",
    })
    @httpGet("/search")
    public async searchUsers(req: Request, res: Response) {
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
                    id: user.user_id,
                    userId: user.user_id,
                    username: user.username,
                    balance: Math.floor(user.balance),
                });
            }
            res.send(filtered);
        } catch (error) {
            console.error("Error searching users", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error searching users", error: message });
        }
    }

    @httpGet("/admin/search")
    public async adminSearchUsers(req: Request, res: Response) {
        const query = (req.query.q as string)?.trim();
        if (!query) {
            return res.status(400).send({ message: "Missing search query" });
        }
        try {
            const users: User[] = await this.userService.adminSearchUsers(query);

            const filtered = [];
            for (const user of users) {
                const discordUser = await this.userService.getDiscordUser(user.user_id);
                filtered.push({
                    ...discordUser,
                    id: user.user_id,
                    userId: user.user_id,
                    username: user.username,
                    balance: Math.floor(user.balance),
                });
            }
            res.send(filtered);
        } catch (error) {
            console.error("Error searching users", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error searching users", error: message });
        }
    }

    // @describe({
    //     endpoint: "/users/getAllUsers",
    //     method: "GET",
    //     description: "Get all users",
    //     responseType: [{ userId: "string", balance: "number", username: "string" }],
    //     example: "GET /api/users/getAllUsers",
    //     requiresAuth: true
    // })
    // @httpGet("/getAllUsers")
    // public async getAllUsers(req: Request, res: Response) {
    //     try {
    //         const users = await this.userService.getAllUsers();
    //         res.send(users.map(u=>{
    //             return {
    //                 id: u.id,
    //                 user_id: u.user_id,
    //                 balance: u.balance,
    //                 username: u.username,
    //                 email: u.email
    //             };
    //         }));
    //     } catch (error) {
    //         console.error("Error fetching all users", error);
    //         const message = (error instanceof Error) ? error.message : String(error);
    //         res.status(500).send({ message: "Error fetching all users", error: message });
    //     }
    // }

    // @httpGet("/admin/getAllUsers", LoggedCheck.middleware)
    // public async adminGetAllUsers(req: AuthenticatedRequest, res: Response) {
    //     if(!req.user.admin) {
    //         return res.status(403).send({ message: "Forbidden" });
    //     }
    //     try {
    //         const users = await this.userService.getAllUsersWithDisabled();
    //         res.send(users.map(u=>{
    //             return {
    //                 id: u.id,
    //                 user_id: u.user_id,
    //                 balance: u.balance,
    //                 username: u.username,
    //                 email: u.email,
    //                 disabled: !!u.disabled,
    //                 admin: !!u.admin
    //             };
    //         }));
    //     } catch (error) {
    //         console.error("Error fetching all users", error);
    //         const message = (error instanceof Error) ? error.message : String(error);
    //         res.status(500).send({ message: "Error fetching all users", error: message });
    //     }
    // }

    @httpPost("/admin/disable/:userId", LoggedCheck.middleware)
    public async disableAccount(req: AuthenticatedRequest, res: Response) {
        const { userId } = req.params;
        const adminUserId = req.user?.user_id;
        if (!adminUserId) {
            return res.status(401).send({ message: "Unauthorized" });
        }
        try {
            await this.userService.disableAccount(userId, adminUserId);
            res.status(200).send({ message: "Account disabled" });
        } catch (error) {
            res.status(403).send({ message: error instanceof Error ? error.message : String(error) });
        }
    }

    @httpPost("/admin/enable/:userId", LoggedCheck.middleware)
    public async reenableAccount(req: AuthenticatedRequest, res: Response) {
        const { userId } = req.params;
        const adminUserId = req.user?.user_id;
        if (!adminUserId) {
            return res.status(401).send({ message: "Unauthorized" });
        }
        try {
            await this.userService.reenableAccount(userId, adminUserId);
            res.status(200).send({ message: "Account re-enabled" });
        } catch (error) {
            res.status(403).send({ message: error instanceof Error ? error.message : String(error) });
        }
    }

   
    @httpGet("/admin/:userId")
    public async adminGetUser(req: Request, res: Response) {
        try {
            await userIdParamValidator.validate(req.params);
        } catch (err) {
            return res.status(400).send({ message: "Invalid userId", error: err });
        }
        const { userId } = req.params;
        const user = await this.userService.adminGetUser(userId);
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }
        // Filter user to only expose allowed fields
        const discordUser = await this.userService.getDiscordUser(user.user_id);
        const filteredUser = {
            ...discordUser,
            id: user.user_id,
            userId: user.user_id,
            balance: Math.floor(user.balance),
            username: user.username,
            disabled: !!user.disabled,
        };
        res.send(filteredUser);
    }

    @describe({
        endpoint: "/users/auth-verification",
        method: "POST",
        description: "Check the verification key for the user",
        responseType: { success: "boolean" },
        query: { userId: "The id of the user", verificationKey: "The verification key" },
        example: "POST /api/users/auth-verification?userId=123&verificationKey=abc123"
    })
    @httpPost("/auth-verification")
    async checkVerificationKey(req: Request, res: Response) {
        const { userId, verificationKey } = req.body;
        if (!userId || !verificationKey) {
            return res.status(400).send({ message: "Missing userId or verificationKey" });
        }
        const user = await this.userService.getUser(userId);
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }
        const expectedKey = genVerificationKey(user.user_id);
        res.send({ success: verificationKey === expectedKey });
    }


    @describe({
        endpoint: "/users/:userId",
        method: "GET",
        description: "Get a user by userId",
        params: { userId: "The id of the user" },
        responseType: { userId: "string", balance: "number", username: "string" },
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
            id: user.user_id,
            userId: user.user_id,
            balance: Math.floor(user.balance),
            username: user.username,
        };
        res.send(filteredUser);
    }

    @httpPost("/register")
    public async register(req: Request, res: Response) {
        const { username, email, password } = req.body;
        let { userId } = req.body;
        if (!username || !email || !password) {
            return res.status(400).send({ message: "Missing required fields" });
        }
        if(!userId) {
            userId = crypto.randomUUID();
        }
        const allUsers = await this.userService.getAllUsers();
        if (allUsers.some(u => u.email === email)) {
            return res.status(409).send({ message: "Email already in use" });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).send({ message: "Invalid email address" });
        }

        // Hash du mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);
        try {
            // TODO: Adapter UserService.createUser pour gérer email et password
            await this.userService.createUser(userId, username , email, hashedPassword );
            res.status(201).send({ message: "User registered", token: genKey(userId) });
        } catch (error) {
            console.error("Error registering user", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error registering user", error: message });
        }
    }

    @httpPost("/login")
    public async login(req: Request, res: Response) {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).send({ message: "Missing email or password" });
        }
        const allUsers = await this.userService.getAllUsersWithDisabled();
        const user = allUsers.find(u => u.email === email);
        if (!user || !user.password) {
            return res.status(401).send({ message: "Invalid credentials" });
        }
        // bcrypt importé en haut
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).send({ message: "Invalid credentials" });
        }
        // Check si le compte est désactivé
        if (user.disabled) {
            return res.status(403).send({ message: "Account is disabled" });
        }
        res.status(200).send({ message: "Login successful", user: { userId: user.user_id, username: user.username, email: user.email }, token: genKey(user.user_id) });
    }

    @httpPost("/change-password", LoggedCheck.middleware)
    public async changePassword(req: AuthenticatedRequest, res: Response) {
        const { oldPassword, newPassword, confirmPassword } = req.body;
        if (!newPassword || !confirmPassword) {
            return res.status(400).send({ message: "Missing newPassword or confirmPassword" });
        }
        if (newPassword !== confirmPassword) {
            return res.status(400).send({ message: "New password and confirm password do not match" });
        }
        const userId = req.user?.user_id;
        if (!userId) {
            return res.status(401).send({ message: "Unauthorized" });
        }
        const user = await this.userService.getUser(userId);
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }
        let valid = true;
        if (user.password) {
            valid = await bcrypt.compare(oldPassword, user.password);
        }
        if (!valid) {
            return res.status(401).send({ message: "Invalid current password" });
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        try {
            await this.userService.updateUserPassword(userId, hashedPassword);
            res.status(200).send({ message: "Password changed successfully" });
        } catch (error) {
            console.error("Error changing password", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error changing password", error: message });
        }
    }

    @describe({
        endpoint: "/users/transfer-credits",
        method: "POST",
        description: "Transfer credits from one user to another",
        body: { targetUserId: "The id of the recipient", amount: "The amount to transfer" },
        responseType: { message: "string" },
        example: "POST /api/users/transfer-credits { targetUserId: '456', amount: 50 }",
        requiresAuth: true
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
