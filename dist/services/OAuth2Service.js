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
exports.OAuth2Service = void 0;
const inversify_1 = require("inversify");
const OAuth2Repository_1 = require("../repositories/OAuth2Repository");
let OAuth2Service = class OAuth2Service {
    constructor(db) {
        this.db = db;
        this.oauth2Repository = new OAuth2Repository_1.OAuth2Repository(this.db);
    }
    async createApp(owner_id, name, redirect_urls) {
        return this.oauth2Repository.createApp(owner_id, name, redirect_urls);
    }
    async getAppsByOwner(owner_id) {
        return this.oauth2Repository.getAppsByOwner(owner_id);
    }
    async getAppByClientId(client_id) {
        return this.oauth2Repository.getAppByClientId(client_id);
    }
    async generateAuthCode(client_id, redirect_uri, user_id) {
        return this.oauth2Repository.generateAuthCode(client_id, redirect_uri, user_id);
    }
    async deleteApp(client_id, owner_id) {
        await this.oauth2Repository.deleteApp(client_id, owner_id);
    }
    async updateApp(client_id, owner_id, update) {
        await this.oauth2Repository.updateApp(client_id, owner_id, update);
    }
    async getUserByCode(code, client_id) {
        return this.oauth2Repository.getUserByCode(code, client_id);
    }
};
exports.OAuth2Service = OAuth2Service;
exports.OAuth2Service = OAuth2Service = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("DatabaseService")),
    __metadata("design:paramtypes", [Object])
], OAuth2Service);
