"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setCachedUser = exports.getCachedUser = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const CACHE_FILE = path_1.default.join(__dirname, "..", "..", "userCache.json");
const CACHE_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
function loadCache() {
    if (!fs_1.default.existsSync(CACHE_FILE))
        return {};
    try {
        return JSON.parse(fs_1.default.readFileSync(CACHE_FILE, "utf-8"));
    }
    catch {
        return {};
    }
}
function saveCache(cache) {
    fs_1.default.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}
function getCachedUser(userId) {
    const cache = loadCache();
    const entry = cache[userId];
    if (!entry)
        return null;
    if (Date.now() - entry.timestamp > CACHE_EXPIRY_MS) {
        delete cache[userId];
        saveCache(cache);
        return null;
    }
    return entry.data;
}
exports.getCachedUser = getCachedUser;
function setCachedUser(userId, data) {
    const cache = loadCache();
    cache[userId] = { data, timestamp: Date.now() };
    saveCache(cache);
}
exports.setCachedUser = setCachedUser;
