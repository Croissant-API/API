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
/* eslint-disable @typescript-eslint/no-explicit-any */
const inversify_1 = require("inversify");
const crypto_1 = __importDefault(require("crypto"));
const GenKey_1 = require("../utils/GenKey");
let StudioService = class StudioService {
    constructor(databaseService, userService) {
        this.databaseService = databaseService;
        this.userService = userService;
    }
    parseUserIds(users) {
        try {
            return JSON.parse(users);
        }
        catch {
            return [];
        }
    }
    async getStudioUsers(userIds) {
        if (!userIds.length)
            return [];
        return this.databaseService.read(`SELECT user_id, username, verified, admin FROM users WHERE user_id IN (${userIds.map(() => "?").join(",")})`, userIds);
    }
    async getStudio(user_id) {
        const studios = await this.databaseService.read("SELECT * FROM studios WHERE user_id = ?", [user_id]);
        if (studios.length === 0)
            return null;
        const studio = studios[0];
        const userIds = this.parseUserIds(studio.users);
        const users = await this.getStudioUsers(userIds);
        return { ...studio, users };
    }
    async getFormattedStudio(user_id) {
        const studioInfo = await this.databaseService.read(`SELECT s.user_id as studio_user_id, u.username, u.verified, s.admin_id, s.users
       FROM studios s
       INNER JOIN users u ON s.user_id = u.user_id
       WHERE s.user_id = ?`, [user_id]);
        if (!studioInfo.length)
            return null;
        const studio = studioInfo[0];
        const userIds = this.parseUserIds(studio.users);
        if (!userIds.length) {
            return {
                user_id: studio.studio_user_id,
                username: studio.username,
                verified: studio.verified,
                admin_id: studio.admin_id,
                users: []
            };
        }
        const users = await this.databaseService.read(`SELECT user_id, username, verified, admin 
       FROM users 
       WHERE user_id IN (${userIds.map(() => "?").join(",")})`, userIds);
        return {
            user_id: studio.studio_user_id,
            username: studio.username,
            verified: studio.verified,
            admin_id: studio.admin_id,
            users
        };
    }
    async setStudioProperties(user_id, admin_id, users) {
        // Met à jour l'admin_id et la liste des users (stockée en JSON)
        const userIds = users.map((u) => u.user_id);
        await this.databaseService.update("UPDATE studios SET admin_id = ?, users = ? WHERE user_id = ?", [admin_id, JSON.stringify(userIds), user_id]);
    }
    async getUserStudios(user_id) {
        const studios = await this.databaseService.read(`SELECT * FROM studios`, []);
        const result = [];
        for (const studio of studios) {
            const userIds = this.parseUserIds(studio.users);
            userIds.push(studio.admin_id);
            const studioUser = await this.userService.getUser(studio.user_id);
            if (userIds.includes(user_id)) {
                const users = await this.getStudioUsers(userIds);
                result.push({
                    ...studio,
                    username: studioUser?.username,
                    verified: studioUser?.verified,
                    users,
                    isAdmin: studio.admin_id === user_id,
                    apiKey: studio.admin_id == user_id ? (0, GenKey_1.genKey)(studio.user_id) : null,
                });
            }
        }
        return result;
    }
    async getFormattedUserStudios(user_id) {
        // Récupère tous les studios où l'utilisateur est membre ou admin
        const studiosInfo = await this.databaseService.read(`SELECT s.user_id as studio_user_id, u.username, u.verified, s.admin_id, s.users
       FROM studios s
       INNER JOIN users u ON s.user_id = u.user_id
       WHERE s.admin_id = ? OR JSON_EXTRACT(s.users, '$') LIKE ?`, [user_id, `%"${user_id}"%`]);
        const result = [];
        for (const studio of studiosInfo) {
            const userIds = this.parseUserIds(studio.users);
            const isAdmin = studio.admin_id === user_id;
            const users = userIds.length > 0 ? await this.databaseService.read(`SELECT user_id, username, verified, admin 
         FROM users 
         WHERE user_id IN (${userIds.map(() => "?").join(",")})`, userIds) : [];
            result.push({
                user_id: studio.studio_user_id,
                username: studio.username,
                verified: studio.verified,
                admin_id: studio.admin_id,
                isAdmin,
                apiKey: isAdmin ? (0, GenKey_1.genKey)(studio.studio_user_id) : undefined,
                users
            });
        }
        return result;
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
            await this.setStudioProperties(studioId, studio.admin_id, [...studio.users, user]);
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
StudioService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("DatabaseService")),
    __param(1, (0, inversify_1.inject)("UserService")),
    __metadata("design:paramtypes", [Object, Object])
], StudioService);
exports.StudioService = StudioService;
