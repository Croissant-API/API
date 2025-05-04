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
exports.UserController = void 0;
const inversify_1 = require("inversify");
const inversify_express_utils_1 = require("inversify-express-utils");
const UserValidator_1 = require("../validators/UserValidator");
const describe_1 = require("../decorators/describe");
const LoggedCheck_1 = require("../middlewares/LoggedCheck");
const GenKey_1 = require("../utils/GenKey");
let UserController = class UserController {
    constructor(userService) {
        this.userService = userService;
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
        const filteredUser = {
            userId: user.user_id,
            balance: user.balance,
            username: user.username,
            verificationKey: (0, GenKey_1.genVerificationKey)(user.user_id)
        };
        res.send(filteredUser);
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
        const filteredUser = {
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
    async searchUsers(req, res) {
        const query = req.query.q?.trim();
        if (!query) {
            return res.status(400).send({ message: "Missing search query" });
        }
        try {
            const users = await this.userService.searchUsersByUsername(query);
            const filtered = users.map(user => ({
                userId: user.user_id,
                username: user.username,
                balance: user.balance,
            }));
            res.send(filtered);
        }
        catch (error) {
            console.error("Error searching users", error);
            const message = (error instanceof Error) ? error.message : String(error);
            res.status(500).send({ message: "Error searching users", error: message });
        }
    }
};
__decorate([
    (0, inversify_express_utils_1.httpGet)("/@me", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "getMe", null);
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
], UserController.prototype, "checkVerificationKey", null);
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
], UserController.prototype, "getUser", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/create"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "createUser", null);
__decorate([
    (0, inversify_express_utils_1.httpGet)("/search", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], UserController.prototype, "searchUsers", null);
UserController = __decorate([
    (0, inversify_express_utils_1.controller)("/users"),
    __param(0, (0, inversify_1.inject)("UserService")),
    __metadata("design:paramtypes", [Object])
], UserController);
exports.UserController = UserController;
