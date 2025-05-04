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
exports.UserService = void 0;
const inversify_1 = require("inversify");
const GenKey_1 = require("../utils/GenKey");
let UserService = class UserService {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async updateUserBalance(user_id, balance) {
        await this.databaseService.update("UPDATE users SET balance = ? WHERE user_id = ?", [balance, user_id]);
    }
    async createUser(user_id, username, balance) {
        await this.databaseService.create("INSERT INTO users (user_id, username, balance) VALUES (?, ?, ?)", [user_id, username, balance]);
    }
    async getUser(user_id) {
        const users = await this.databaseService.read("SELECT * FROM users WHERE user_id = ?", [user_id]);
        return users.length > 0 ? users[0] : null;
    }
    async getAllUsers() {
        return await this.databaseService.read("SELECT * FROM users");
    }
    async updateUser(user_id, username, balance) {
        const updates = [];
        const params = [];
        if (username !== undefined) {
            updates.push("username = ?");
            params.push(username);
        }
        if (balance !== undefined) {
            updates.push("balance = ?");
            params.push(balance);
        }
        if (updates.length === 0)
            return;
        params.push(user_id);
        await this.databaseService.update(`UPDATE users SET ${updates.join(", ")} WHERE user_id = ?`, params);
    }
    async deleteUser(user_id) {
        await this.databaseService.delete("DELETE FROM users WHERE user_id = ?", [user_id]);
    }
    async authenticateUser(api_key) {
        const users = await this.getAllUsers();
        if (!users) {
            console.error("Error fetching users", users);
            return null;
        }
        const user = users.find((user) => (0, GenKey_1.genKey)(user.user_id) === api_key) || null;
        if (!user) {
            console.error("User not found or API key mismatch", api_key);
            return null;
        }
        return user;
    }
};
UserService = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)("DatabaseService")),
    __metadata("design:paramtypes", [Object])
], UserService);
exports.UserService = UserService;
