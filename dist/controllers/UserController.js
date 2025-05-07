"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Users = void 0;
const inversify_1 = require("inversify");
const inversify_express_utils_1 = require("inversify-express-utils");
const UserValidator_1 = require("../validators/UserValidator");
const describe_1 = require("../decorators/describe");
const LoggedCheck_1 = require("../middlewares/LoggedCheck");
const GenKey_1 = require("../utils/GenKey");
let Users = class Users {
    constructor(userService) {
        this.userService = userService;
    }
    async addUser(req, res) {
        try {
            await UserValidator_1.createUserValidator.validate(req.body);
        }
        catch (err) {
            return res.status(400).send({ message: "Invalid user data", error: err });
        }
        const { id, username } = req.body;
        const balance = req.body.balance || 0; // Default balance to 0 if not provided
        try {
            await this.userService.createUser(id, username, balance);
            res.status(201).send({ message: "User added" });
        }
        catch (error) {
            console.error("Error adding user", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error adding user", error: message });
        }
    }
    async getMe(req, res) {
        const userId = req.user?.user_id;
        if (!userId) {
            return res.status(401).send({ message: "Unauthorized" });
        }
        const user = await this.userService.getUser(userId);
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }
        // Filter user to only expose allowed fields
        const discordUser = await this.userService.getDiscordUser(user.user_id);
        const filteredUser = {
            ...discordUser,
            userId: user.user_id,
            balance: user.balance,
            username: user.username,
            verificationKey: (0, GenKey_1.genVerificationKey)(user.user_id)
        };
        res.send(filteredUser);
    }
    async searchUsers(req, res) {
        const query = req.query.q?.trim();
        if (!query) {
            return res.status(400).send({ message: "Missing search query" });
        }
        try {
            const users = await this.userService.searchUsersByUsername(query);
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
        }
        catch (error) {
            console.error("Error searching users", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error searching users", error: message });
        }
    }
    async checkVerificationKey(req, res) {
        const { userId, verificationKey } = req.query;
        if (!userId || !verificationKey) {
            return res.status(400).send({ message: "Missing userId or verificationKey" });
        }
        const user = await this.userService.getUser(userId);
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }
        const expectedKey = (0, GenKey_1.genVerificationKey)(user.user_id);
        res.send({ success: verificationKey !== expectedKey });
    }
    async getUser(req, res) {
        try {
            await UserValidator_1.userIdParamValidator.validate(req.params);
        }
        catch (err) {
            return res.status(400).send({ message: "Invalid userId", error: err });
        }
        const { userId } = req.params;
        const user = await this.userService.getUser(userId);
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }
        // Filter user to only expose allowed fields
        const discordUser = await this.userService.getDiscordUser(user.user_id);
        const filteredUser = {
            ...discordUser,
            userId: user.user_id,
            balance: user.balance,
            username: user.username,
        };
        res.send(filteredUser);
    }
    async createUser(req, res) {
        try {
            await UserValidator_1.createUserValidator.validate(req.body);
        }
        catch (err) {
            return res.status(400).send({ message: "Invalid user data", error: err });
        }
        const { userId, username, balance } = req.body;
        try {
            await this.userService.createUser(userId, username, balance);
            res.status(201).send({ message: "User created" });
        }
        catch (error) {
            console.error("Error creating user", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error creating user", error: message });
        }
    }
    async transferCredits(req, res) {
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
        }
        catch (error) {
            console.error("Error transferring credits", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error transferring credits", error: message });
        }
    }
};
__decorate([
    (0, describe_1.describe)({
        endpoint: "/users",
        method: "POST",
        description: "Add a new user",
        body: { userId: "The id of the user", username: "The username of the user", balance: "The balance of the user" },
        responseType: "object{message: string}",
        example: "POST /api/users { userId: '123', username: 'JohnDoe', balance: 100 }"
    }),
    (0, inversify_express_utils_1.httpPost)("/"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "addUser", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/users/@me",
        method: "GET",
        description: "Get the authenticated user's information",
        responseType: "object{userId: string, balance: number, username: string}",
        example: "GET /api/users/@me"
    }),
    (0, inversify_express_utils_1.httpGet)("/@me", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "getMe", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/users/search",
        method: "GET",
        description: "Search for users by username",
        query: { q: "The search query" },
        responseType: "array[object{userId: string, balance: number, username: string}]",
        example: "GET /api/users/search?q=John"
    }),
    (0, inversify_express_utils_1.httpGet)("/search", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "searchUsers", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/users/auth-verification",
        method: "GET",
        description: "Check the verification key for the user",
        responseType: "object{success: boolean}",
        query: { userId: "The id of the user", verificationKey: "The verification key" },
        example: "GET /api/users/auth-verification?userId=123&verificationKey=abc123"
    }),
    (0, inversify_express_utils_1.httpPost)("/auth-verification"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "checkVerificationKey", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/users/:userId",
        method: "GET",
        description: "Get a user by userId",
        params: { userId: "The id of the user" },
        responseType: "object{userId: string, balance: number, username: string}",
        example: "GET /api/users/123"
    }),
    (0, inversify_express_utils_1.httpGet)("/:userId"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "getUser", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/create"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "createUser", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/users/transfer-credits",
        method: "POST",
        description: "Transfer credits from one user to another",
        body: { targetUserId: "The id of the recipient", amount: "The amount to transfer" },
        responseType: "object{message: string}",
        example: "POST /api/users/transfer-credits { targetUserId: '456', amount: 50 }"
    }),
    (0, inversify_express_utils_1.httpPost)("/transfer-credits", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Users.prototype, "transferCredits", null);
Users = __decorate([
    (0, inversify_express_utils_1.controller)("/users"),
    __param(0, (0, inversify_1.inject)("UserService")),
    __metadata("design:paramtypes", [Object])
], Users);
exports.Users = Users;
