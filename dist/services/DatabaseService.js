"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const inversify_1 = require("inversify");
const mongodb_1 = require("mongodb");
require("reflect-metadata");
let DatabaseService = class DatabaseService {
    constructor() {
        this.db = null;
        this.client = new mongodb_1.MongoClient(process.env.MONGO_URI);
        this.client.connect()
            .then(async () => {
            this.db = this.client.db(process.env.MONGO_DB);
            await this.db.command({ ping: 1 });
            console.log('MongoDB connection established');
        })
            .catch(err => {
            console.error('MongoDB connection error:', err);
        });
    }
    async getDb() {
        // if (!this.db) {
        //   throw new Error('Database not initialized');
        // }
        if (!this.db) {
            // Wait for the database to be initialized
            await new Promise((resolve, reject) => {
                const checkDb = () => {
                    if (this.db) {
                        resolve();
                    }
                    setTimeout(checkDb, 100);
                };
                checkDb();
            });
        }
        // We assume that by the time we get here, the database is initialized. If not, it will throw an error.
        return this.db;
    }
    async destroy() {
        await this.client.close();
    }
};
exports.DatabaseService = DatabaseService;
exports.DatabaseService = DatabaseService = __decorate([
    (0, inversify_1.injectable)()
], DatabaseService);
