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
const inversify_1 = require("inversify");
require("reflect-metadata");
let DatabaseService = class DatabaseService {
    constructor() {
        this.workerUrl = process.env.WORKER_URL;
        const user = process.env.WORKER_USER;
        const pass = process.env.WORKER_PASS;
        this.authHeader = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
        this.testConnection();
    }
    async testConnection() {
        try {
            await this.runQuery("SELECT 1 as test");
            console.log('Database Worker connection established');
        }
        catch (err) {
            console.error('Database Worker connection error:', err);
        }
    }
    async runQuery(sql, format = "json") {
        const headers = {
            "Content-Type": "application/json",
            "Accept": format === "csv" ? "text/csv" : "application/json",
            "Authorization": this.authHeader
        };
        const body = JSON.stringify({ query: sql });
        const res = await fetch(this.workerUrl, {
            method: "POST",
            headers,
            body
        });
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Worker error ${res.status}: ${errText}`);
        }
        if (format === "csv") {
            return await res.text();
        }
        else {
            return await res.json();
        }
    }
    interpolateParams(query, params = []) {
        let index = 0;
        return query.replace(/\?/g, () => {
            if (index >= params.length) {
                throw new Error('Not enough parameters provided for query');
            }
            const param = params[index++];
            if (typeof param === 'string') {
                return `'${param.replace(/'/g, "''")}'`;
            }
            else if (param === null || param === undefined) {
                return 'NULL';
            }
            else {
                return String(param);
            }
        });
    }
    async request(query, params = []) {
        try {
            const interpolatedQuery = this.interpolateParams(query, params);
            await this.runQuery(interpolatedQuery);
        }
        catch (err) {
            console.error('Error executing query', err);
            throw err;
        }
    }
    async read(query, params = []) {
        try {
            const interpolatedQuery = this.interpolateParams(query, params);
            const result = await this.runQuery(interpolatedQuery, "json");
            let rows = [];
            if (typeof result === 'object' && result !== null && 'results' in result) {
                rows = result.results || [];
            }
            if (!Array.isArray(rows)) {
                console.warn('Database query returned non-array result:', rows);
                return [];
            }
            return rows.map((row) => {
                if (typeof row === 'object' && row !== null) {
                    const processedRow = { ...row };
                    for (const key in processedRow) {
                        if (typeof processedRow[key] === 'string') {
                            try {
                                const parsed = JSON.parse(processedRow[key]);
                                processedRow[key] = parsed;
                            }
                            catch {
                                console.log('Value is not JSON, leaving as string');
                            }
                        }
                    }
                    return processedRow;
                }
                return row;
            });
        }
        catch (err) {
            console.error('Error reading data', err);
            throw err;
        }
    }
    async destroy() {
        console.log('DatabaseService destroyed');
    }
};
exports.DatabaseService = DatabaseService;
exports.DatabaseService = DatabaseService = __decorate([
    (0, inversify_1.injectable)(),
    __metadata("design:paramtypes", [])
], DatabaseService);
exports.default = DatabaseService;
