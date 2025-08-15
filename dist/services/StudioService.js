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
const StudioRepository_1 = require("../repositories/StudioRepository");
const crypto_1 = __importDefault(require("crypto"));
const GenKey_1 = require("../utils/GenKey");
let StudioService = class StudioService {
    constructor(databaseService, userService) {
        this.databaseService = databaseService;
        this.userService = userService;
        this.studioRepository = new StudioRepository_1.StudioRepository(this.databaseService);
    }
    async getStudio(user_id) {
        const studioResponse = await this.studioRepository.getStudio(user_id);
        if (!studioResponse)
            return null;
        const users = await this.getUsersByIds(studioResponse.users);
        const me = (await this.userService.getUserWithPublicProfile(studioResponse.user_id));
        return { ...studioResponse, users, me };
    }
    async setStudioProperties(user_id, admin_id, users) {
        const userIds = users.map((u) => u.user_id);
        await this.studioRepository.setStudioProperties(user_id, admin_id, userIds);
    }
    async getUserStudios(user_id) {
        const studiosResponse = await this.studioRepository.getUserStudios(user_id);
        const studios = await Promise.all(studiosResponse.map(async (studioResponse) => {
            const userIds = [
                ...studioResponse.users,
                studioResponse.admin_id,
            ];
            const users = await this.getUsersByIds(userIds);
            const me = (await this.userService.getUser(studioResponse.user_id));
            return {
                user_id: studioResponse.user_id,
                admin_id: studioResponse.admin_id,
                users,
                me,
                apiKey: studioResponse.admin_id === user_id
                    ? (0, GenKey_1.genKey)(studioResponse.user_id)
                    : undefined,
            };
        }));
        return studios;
    }
    async createStudio(studioName, admin_id) {
        const user_id = crypto_1.default.randomUUID();
        await this.userService.createBrandUser(user_id, studioName);
        await this.studioRepository.createStudio(user_id, admin_id);
    }
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
    async removeUserFromStudio(studioId, userId) {
        const studio = await this.getStudio(studioId);
        if (!studio)
            throw new Error("Studio not found");
        await this.setStudioProperties(studioId, studio.admin_id, studio.users.filter((u) => u.user_id !== userId));
    }
    async getUser(user_id) {
        return await this.userService.getUser(user_id);
    }
    async getUsersByIds(userIds) {
        if (userIds.length === 0)
            return [];
        return await this.databaseService.read(`SELECT user_id, username, verified, admin FROM users WHERE user_id IN (${userIds.map(() => "?").join(",")})`, userIds);
    }
};
exports.StudioService = StudioService;
exports.StudioService = StudioService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("DatabaseService")),
    __param(1, (0, inversify_1.inject)("UserService")),
    __metadata("design:paramtypes", [Object, Object])
], StudioService);
