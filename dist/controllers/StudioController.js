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
exports.Studios = void 0;
const inversify_express_utils_1 = require("inversify-express-utils");
const inversify_1 = require("inversify");
const LoggedCheck_1 = require("../middlewares/LoggedCheck");
const describe_1 = require("../decorators/describe");
let Studios = class Studios {
    constructor(studioService) {
        this.studioService = studioService;
    }
    // --- Création de studio ---
    async createStudio(req, res) {
        if (req.user.isStudio) {
            return res
                .status(403)
                .send({ message: "A studio can't create another studio" });
        }
        const { studioName } = req.body;
        if (!studioName) {
            return res.status(400).send({ message: "Missing required fields" });
        }
        try {
            await this.studioService.createStudio(studioName, req.user.user_id);
            res.status(201).send({ message: "Studio created" });
        }
        catch (error) {
            res
                .status(500)
                .send({
                message: "Error creating studio",
                error: error.message,
            });
        }
    }
    // --- Récupération d’un studio ---
    async getStudio(req, res) {
        const { studioId } = req.params;
        const studio = await this.studioService.getStudio(studioId);
        if (!studio) {
            return res.status(404).send({ message: "Studio not found" });
        }
        res.send(studio);
    }
    // --- Gestion des membres ---
    async addUserToStudio(req, res) {
        const { studioId } = req.params;
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).send({ message: "Missing userId" });
        }
        const user = await this.studioService.getUser(userId);
        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }
        try {
            await this.studioService.addUserToStudio(studioId, user);
            res.send({ message: "User added to studio" });
        }
        catch (error) {
            res
                .status(500)
                .send({
                message: "Error adding user to studio",
                error: error.message,
            });
        }
    }
    async removeUserFromStudio(req, res) {
        const { studioId } = req.params;
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).send({ message: "Missing userId" });
        }
        const studio = await this.studioService.getStudio(studioId);
        if (!studio) {
            return res.status(404).send({ message: "Studio not found" });
        }
        if (studio.admin_id === req.originalUser?.user_id &&
            studio.admin_id === userId) {
            return res
                .status(403)
                .send({ message: "Cannot remove the studio admin" });
        }
        if (req.originalUser?.user_id !== studio.admin_id) {
            return res
                .status(403)
                .send({ message: "Only the studio admin can remove users" });
        }
        try {
            await this.studioService.removeUserFromStudio(studioId, userId);
            res.send({ message: "User removed from studio" });
        }
        catch (error) {
            res
                .status(500)
                .send({
                message: "Error removing user from studio",
                error: error.message,
            });
        }
    }
};
__decorate([
    (0, inversify_express_utils_1.httpPost)("/", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Studios.prototype, "createStudio", null);
__decorate([
    (0, describe_1.describe)({
        endpoint: "/studios/:studioId",
        method: "GET",
        description: "Get a studio by studioId",
        params: { studioId: "The ID of the studio to retrieve" },
        responseType: {
            studio_id: "string",
            name: "string",
            admin_id: "string",
            users: "User[]",
        },
        exampleResponse: {
            studio_id: "studio123",
            name: "My Studio",
            admin_id: "user1",
            users: [
                {
                    user_id: "user1",
                    username: "User One",
                    verified: true,
                    isStudio: false,
                    admin: false,
                },
                {
                    user_id: "user2",
                    username: "User Two",
                    verified: true,
                    isStudio: false,
                    admin: false,
                },
            ],
        },
    }),
    (0, inversify_express_utils_1.httpGet)(":studioId"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Studios.prototype, "getStudio", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)(":/studioId/add-user", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Studios.prototype, "addUserToStudio", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)(":/studioId/remove-user", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Studios.prototype, "removeUserFromStudio", null);
Studios = __decorate([
    (0, inversify_express_utils_1.controller)("/studios"),
    __param(0, (0, inversify_1.inject)("StudioService")),
    __metadata("design:paramtypes", [Object])
], Studios);
exports.Studios = Studios;
