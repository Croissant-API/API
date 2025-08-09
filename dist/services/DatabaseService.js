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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const knex_1 = require("knex");
const inversify_1 = require("inversify");
require("reflect-metadata");
let DatabaseService = class DatabaseService {
    constructor() {
        console.log(process.env.DB_HOST, process.env.DB_USER, process.env.DB_NAME);
        this.db = (0, knex_1.knex)({
            client: "mysql",
            connection: {
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                port: 3306,
                password: process.env.DB_PASS,
                database: process.env.DB_NAME,
            },
            useNullAsDefault: true,
        });
        this.db
            .raw("SELECT 1")
            .then(() => {
            console.log("Database connection established");
        })
            .catch((err) => {
            console.error("Database connection error:", err);
        });
    }
    getKnex() {
        return this.db;
    }
    async request(query, params = []) {
        try {
            await this.db.raw(query, params);
        }
        catch (err) {
            console.error("Error executing query", err);
            throw err;
        }
    }
    async read(query, params = []) {
        try {
            const result = await this.db.raw(query, params);
            // Pour MySQL, result = [rows, fields]
            const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
            return rows.map((row) => {
                for (const key in row) {
                    if (typeof row[key] === "string") {
                        try {
                            const parsed = JSON.parse(row[key]);
                            row[key] = parsed;
                            // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        }
                        catch (e) {
                            // Not a JSON string, leave as is
                        }
                    }
                }
                return row;
            });
        }
        catch (err) {
            console.error("Error reading data", err);
            throw err;
        }
    }
    async destroy() {
        await this.db.destroy();
    }
};
exports.DatabaseService = DatabaseService;
exports.DatabaseService = DatabaseService = __decorate([
    (0, inversify_1.injectable)(),
    __metadata("design:paramtypes", [])
], DatabaseService);
exports.default = DatabaseService;
