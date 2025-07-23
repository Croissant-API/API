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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const inversify_1 = require("inversify");
let DatabaseService = class DatabaseService {
    constructor() {
        this.init().then((db) => (this.db = db));
    }
    async init() {
        try {
            this.db = await (0, sqlite_1.open)({
                filename: __dirname + "/../../database.db",
                driver: sqlite3_1.default.Database,
            });
            return this.db;
        }
        catch (err) {
            console.error("Error opening database", err);
            throw err;
        }
    }
    ensureDb() {
        if (!this.db)
            throw new Error("Database not initialized");
        return this.db;
    }
    async create(query, params = []) {
        try {
            await this.ensureDb().run(query, params);
        }
        catch (err) {
            console.error("Error creating data", err);
            throw err;
        }
    }
    async read(query, params = []) {
        try {
            const rows = await this.ensureDb().all(query, params);
            return rows || [];
        }
        catch (err) {
            console.error("Error reading data", err);
            throw err;
        }
    }
    async update(query, params = []) {
        try {
            await this.ensureDb().run(query, params);
        }
        catch (err) {
            console.error("Error updating data", err);
            throw err;
        }
    }
    async delete(query, params = []) {
        try {
            await this.ensureDb().run(query, params);
        }
        catch (err) {
            console.error("Error deleting data", err);
            throw err;
        }
    }
};
DatabaseService = __decorate([
    (0, inversify_1.injectable)(),
    __metadata("design:paramtypes", [])
], DatabaseService);
exports.DatabaseService = DatabaseService;
exports.default = DatabaseService;
