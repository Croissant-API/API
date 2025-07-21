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
exports.StudioController = void 0;
const inversify_express_utils_1 = require("inversify-express-utils");
const inversify_1 = require("inversify");
const LoggedCheck_1 = require("../middlewares/LoggedCheck");
let StudioController = class StudioController {
    constructor(studioService) {
        this.studioService = studioService;
    }
    /**
     * GET /studios/:studioId
     * Récupère un studio par son user_id
     */
    async getStudio(req, res) {
        const { studioId } = req.params;
        const studio = await this.studioService.getStudio(studioId);
        if (!studio) {
            return res.status(404).send({ message: "Studio not found" });
        }
        res.send(studio);
    }
    /**
     * POST /studios
     * Crée un studio
     * Body: { userId, adminId, studioName, adminUsername, adminEmail, adminPassword }
     */
    async createStudio(req, res) {
        if (req.user.isStudio) {
            return res.status(403).send({ message: "A studio can't create another studio" });
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
            res.status(500).send({ message: "Error creating studio", error: error.message });
        }
    }
    /**
     * POST /studios/:studioId/properties
     * Met à jour les propriétés d'un studio (admin_id, users)
     * Body: { adminId, users: User[] }
     */
    async setStudioProperties(req, res) {
        const { studioId } = req.params;
        const { adminId, users } = req.body;
        if (!adminId || !Array.isArray(users)) {
            return res.status(400).send({ message: "Missing adminId or users" });
        }
        try {
            await this.studioService.setStudioProperties(studioId, adminId, users);
            res.send({ message: "Studio properties updated" });
        }
        catch (error) {
            res.status(500).send({ message: "Error updating studio properties", error: error.message });
        }
    }
    /**
     * POST /studios/:studioId/add-user
     * Ajoute un utilisateur à un studio
     * Body: { user: User }
     */
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
            res.status(500).send({ message: "Error adding user to studio", error: error.message });
        }
    }
    /**
     * POST /studios/:studioId/remove-user
     * Retire un utilisateur d'un studio
     * Body: { userId: string }
     */
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
        if (studio.admin_id === req.originalUser?.user_id && studio.admin_id === userId) {
            return res.status(403).send({ message: "Cannot remove the studio admin" });
        }
        if (req.originalUser?.user_id !== studio.admin_id) {
            return res.status(403).send({ message: "Only the studio admin can remove users" });
        }
        try {
            await this.studioService.removeUserFromStudio(studioId, userId);
            res.send({ message: "User removed from studio" });
        }
        catch (error) {
            res.status(500).send({ message: "Error removing user from studio", error: error.message });
        }
    }
};
__decorate([
    (0, inversify_express_utils_1.httpGet)(":studioId"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StudioController.prototype, "getStudio", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StudioController.prototype, "createStudio", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/:studioId/properties"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StudioController.prototype, "setStudioProperties", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/:studioId/add-user", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StudioController.prototype, "addUserToStudio", null);
__decorate([
    (0, inversify_express_utils_1.httpPost)("/:studioId/remove-user", LoggedCheck_1.LoggedCheck.middleware),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], StudioController.prototype, "removeUserFromStudio", null);
StudioController = __decorate([
    (0, inversify_express_utils_1.controller)("/studios"),
    __param(0, (0, inversify_1.inject)("StudioService")),
    __metadata("design:paramtypes", [Object])
], StudioController);
exports.StudioController = StudioController;
