/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs";
import path from "path";

const CACHE_FILE = path.join(__dirname, "..", "..", "userCache.json");
const CACHE_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

type CachedUser = {
    data: [any];
    timestamp: number;
};

type Cache = Record<string, CachedUser>;

function loadCache(): Cache {
    if (!fs.existsSync(CACHE_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
    } catch {
        return {};
    }
}

function saveCache(cache: Cache) {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

export function getCachedUser(userId: string): any | null {
    const cache = loadCache();
    const entry = cache[userId];
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_EXPIRY_MS) {
        delete cache[userId];
        saveCache(cache);
        return null;
    }
    return entry.data;
}

export function setCachedUser(userId: string, data: any) {
    const cache = loadCache();
    cache[userId] = { data, timestamp: Date.now() };
    saveCache(cache);
}