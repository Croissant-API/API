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
import crypto from 'crypto';
import { inject, injectable } from 'inversify';
import { StudioRepository } from '../repositories/StudioRepository';
import { genKey } from '../utils/GenKey';
let StudioService = class StudioService {
    constructor(db, userService) {
        this.db = db;
        this.userService = userService;
        this.studioRepository = new StudioRepository(this.db);
    }
    async getStudio(user_id) {
        const studio = await this.studioRepository.getStudio(user_id);
        if (!studio)
            return null;
        const users = await this.getUsersByIds(studio.admin_id, studio.users);
        const me = (await this.userService.getUserWithPublicProfile(studio.user_id));
        if (me && me.badges) {
            if (typeof me.badges === 'string') {
                try {
                    me.badges = JSON.parse(me.badges);
                }
                catch {
                    me.badges = [];
                }
            }
            me.badges = me.badges.filter((b) => !!b);
        }
        return { ...studio, users, me };
    }
    async setStudioProperties(user_id, admin_id, users) {
        await this.studioRepository.setStudioProperties(user_id, admin_id, users.map(u => u.user_id));
    }
    async getUserStudios(user_id) {
        const studios = await this.studioRepository.getUserStudios(user_id);
        return Promise.all(studios.map(async (s) => {
            const userIds = [...s.users, s.admin_id];
            const users = await this.getUsersByIds(s.admin_id, userIds);
            const me = (await this.userService.getUser(s.user_id));
            return {
                user_id: s.user_id,
                admin_id: s.admin_id,
                users,
                me,
                isAdmin: s.admin_id === user_id,
                apiKey: s.admin_id === user_id ? genKey(s.user_id) : undefined,
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
    async getUsersByIds(admin_id, userIds) {
        // if (!Array.isArray(userIds) || !userIds.length) return [];
        if (!Array.isArray(userIds))
            userIds = JSON.parse(userIds);
        userIds = [...admin_id, ...userIds];
        return this.db.read(`SELECT user_id, username, verified, admin FROM users WHERE user_id IN (${userIds.map(() => '?').join(',')})`, userIds);
    }
};
StudioService = __decorate([
    injectable(),
    __param(0, inject('DatabaseService')),
    __param(1, inject('UserService')),
    __metadata("design:paramtypes", [Object, Object])
], StudioService);
export { StudioService };
