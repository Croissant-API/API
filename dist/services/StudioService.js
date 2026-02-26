"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudioService = void 0;
// crypto shim: prefer Web Crypto in edge
const crypto = globalThis.crypto || require('crypto');
const inversify_1 = require("inversify");
const StudioRepository_1 = require("../repositories/StudioRepository");
const GenKey_1 = require("../utils/GenKey");
let StudioService = class StudioService {
    constructor(db, userService) {
        this.db = db;
        this.userService = userService;
        this.studioRepository = new StudioRepository_1.StudioRepository(this.db);
    }
    async getStudio(user_id) {
        const studio = await this.studioRepository.getStudio(user_id);
        if (!studio)
            return null;
        const users = await this.getUsersByIds(studio.users.map(u => u.user_id));
        const me = (await this.userService.getUserWithPublicProfile(studio.user_id));
        return { ...studio, users, me };
    }
    async setStudioProperties(user_id, admin_id, users) {
        await this.studioRepository.setStudioProperties(user_id, admin_id, users.map(u => u.user_id));
    }
    async getUserStudios(user_id) {
        const studios = await this.studioRepository.getUserStudios(user_id);
        return Promise.all(studios.map(async (s) => {
            const userIds = [...s.users, s.admin_id];
            const users = await this.getUsersByIds(userIds);
            const me = (await this.userService.getUser(s.user_id));
            return {
                user_id: s.user_id,
                admin_id: s.admin_id,
                users,
                me,
                apiKey: s.admin_id === user_id ? (0, GenKey_1.genKey)(s.user_id) : undefined,
            };
        }));
    }
    async createStudio(studioName, admin_id) {
        const user_id = crypto.randomUUID();
        await this.userService.createBrandUser(user_id, studioName);
        await this.studioRepository.createStudio(user_id, admin_id);
    }
    async addUserToStudio(studioId, user) {
        const studio = await this.getStudio(studioId);
        if (!studio)
            throw new Error('Studio not found');
        if (!studio.users.some(u => u.user_id === user.user_id)) {
            await this.setStudioProperties(studioId, studio.admin_id, [...studio.users, user]);
        }
    }
    async removeUserFromStudio(studioId, userId) {
        const studio = await this.getStudio(studioId);
        if (!studio)
            throw new Error('Studio not found');
        await this.setStudioProperties(studioId, studio.admin_id, studio.users.filter(u => u.user_id !== userId));
    }
    async getUser(user_id) {
        return this.userService.getUser(user_id);
    }
    async getUsersByIds(userIds) {
        if (!userIds.length)
            return [];
        const users = await this.userService.getAllUsersWithDisabled();
        // return users.filter(u => userIds.some(user => user.user_id === u.user_id));
        return users.filter(u => userIds.includes(u.user_id));
        // return this.db.read<User>(`SELECT user_id, username, verified, admin FROM users WHERE user_id IN (${userIds.map(() => '?').join(',')})`, userIds);
    }
};
exports.StudioService = StudioService;
exports.StudioService = StudioService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)('DatabaseService')),
    __param(1, (0, inversify_1.inject)('UserService'))
], StudioService);
