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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudioService = void 0;
const inversify_1 = require("inversify");
const crypto_1 = __importDefault(require("crypto"));
const GenKey_1 = require("../utils/GenKey");
let StudioService = class StudioService {
    constructor(databaseService, userService) {
        this.databaseService = databaseService;
        this.userService = userService;
    }
    async getStudio(user_id) {
        const studiosResponse = await this.databaseService.read("SELECT * FROM studios WHERE user_id = ?", [user_id]);
        if (studiosResponse.length === 0)
            return null;
        const studioResponse = studiosResponse[0];
        const userIds = studioResponse.users;
        const users = await this.databaseService.read(`SELECT user_id, username, verified, admin FROM users WHERE user_id IN (${userIds.map(() => "?").join(",")})`, userIds);
        const me = (await this.userService.getUserWithPublicProfile(studioResponse.user_id));
        return { ...studioResponse, users, me };
    }
    async setStudioProperties(user_id, admin_id, users) {
        // Met à jour l'admin_id et la liste des users (stockée en JSON)
        const userIds = users.map((u) => u.user_id);
        await this.databaseService.update("UPDATE studios SET admin_id = ?, users = ? WHERE user_id = ?", [admin_id, JSON.stringify(userIds), user_id]);
    }
    async getUserStudios(user_id) {
        const studiosResponse = await this.databaseService.read(`SELECT * FROM studios WHERE admin_id = ? OR users LIKE ?`, [
            user_id,
            `%"${user_id}"%`,
        ]);
        const studios = await Promise.all(studiosResponse.map(async (studioResponse) => {
            // users est un tableau d'id users, on va donc concaténer les utilisateurs
            const userIds = [...studioResponse.users, user_id];
            const users = await this.databaseService.read(`SELECT user_id, username, verified, admin FROM users WHERE user_id IN (${userIds.map(() => "?").join(",")})`, userIds);
            const me = (await this.userService.getUser(studioResponse.user_id));
            return {
                user_id: studioResponse.user_id,
                admin_id: studioResponse.admin_id,
                users: users,
                me: me,
                apiKey: studioResponse.admin_id == user_id
                    ? (0, GenKey_1.genKey)(studioResponse.user_id)
                    : undefined,
            };
        }));
        return studios;
    }
    async createStudio(studioName, admin_id) {
        // Crée l'utilisateur admin si besoin (ou récupère l'existant)
        const user_id = crypto_1.default.randomUUID();
        await this.userService.createBrandUser(user_id, studioName);
        // Crée le studio
        await this.databaseService.create("INSERT INTO studios (user_id, admin_id, users) VALUES (?, ?, ?)", [user_id, admin_id, JSON.stringify([])]);
    }
    /**
     * Ajoute un utilisateur à un studio
     * @param studioId L'identifiant du studio (user_id du studio)
     * @param user L'utilisateur à ajouter
     */
    async addUserToStudio(studioId, user) {
        const studio = await this.getStudio(studioId);
        if (!studio)
            throw new Error("Studio not found");
        const userIds = studio.users.map((u) => u.user_id);
        if (!userIds.includes(user.user_id)) {
            await this.setStudioProperties(studioId, studio.admin_id, [
                ...studio.users,
                user,
            ]);
        }
    }
    /**
     * Retire un utilisateur d'un studio
     * @param studioId L'identifiant du studio (user_id du studio)
     * @param userId L'identifiant de l'utilisateur à retirer
     */
    async removeUserFromStudio(studioId, userId) {
        const studio = await this.getStudio(studioId);
        if (!studio)
            throw new Error("Studio not found");
        await this.setStudioProperties(studioId, studio.admin_id, studio.users.filter((u) => u.user_id !== userId));
    }
    async getUser(user_id) {
        return await this.userService.getUser(user_id);
    }
};
exports.StudioService = StudioService;
exports.StudioService = StudioService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("DatabaseService")),
    __param(1, (0, inversify_1.inject)("UserService")),
    __metadata("design:paramtypes", [Object, Object])
], StudioService);
