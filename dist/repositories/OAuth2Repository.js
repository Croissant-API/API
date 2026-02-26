"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuth2Repository = void 0;
const uuid_1 = require("uuid");
class OAuth2Repository {
    constructor(db) {
        this.db = db;
    }
    async createApp(owner_id, name, redirect_urls) {
        const client_id = (0, uuid_1.v4)();
        const client_secret = (0, uuid_1.v4)();
        const db = await this.db.getDb();
        await db.collection('oauth2_apps').insertOne({
            owner_id,
            client_id,
            client_secret,
            name,
            redirect_urls
        });
        return { owner_id, client_id, client_secret, name, redirect_urls };
    }
    async getApps(filters = {}, select = '*') {
        const db = await this.db.getDb();
        const query = {};
        if (filters.owner_id)
            query.owner_id = filters.owner_id;
        if (filters.client_id)
            query.client_id = filters.client_id;
        const docs = await db.collection('oauth2_apps').find(query).toArray();
        const apps = docs.map(doc => ({
            owner_id: doc.owner_id,
            client_id: doc.client_id,
            client_secret: doc.client_secret,
            name: doc.name,
            redirect_urls: doc.redirect_urls
        }));
        return apps;
    }
    async getAppsByOwner(owner_id) {
        return this.getApps({ owner_id });
    }
    async getFormattedAppsByOwner(owner_id) {
        const db = await this.db.getDb();
        const apps = await db.collection('oauth2_apps')
            .find({ owner_id })
            .project({ client_id: 1, client_secret: 1, name: 1, redirect_urls: 1, _id: 0 })
            .toArray();
        return apps.map(app => ({
            client_id: app.client_id,
            client_secret: app.client_secret,
            name: app.name,
            redirect_urls: app.redirect_urls,
        }));
    }
    async getAppByClientId(client_id) {
        const db = await this.db.getDb();
        const app = await db.collection('oauth2_apps').findOne({ client_id });
        if (!app)
            return null;
        return {
            owner_id: app.owner_id,
            client_id: app.client_id,
            client_secret: app.client_secret,
            name: app.name,
            redirect_urls: app.redirect_urls
        };
    }
    async getFormattedAppByClientId(client_id) {
        const db = await this.db.getDb();
        const app = await db.collection('oauth2_apps')
            .findOne({ client_id }, { projection: { client_id: 1, client_secret: 1, name: 1, redirect_urls: 1, _id: 0 } });
        if (!app)
            return null;
        return app;
    }
    async generateAuthCode(client_id, redirect_uri, user_id) {
        const code = (0, uuid_1.v4)();
        const db = await this.db.getDb();
        await db.collection('oauth2_codes').insertOne({ code, client_id, redirect_uri, user_id });
        return code;
    }
    async deleteApp(client_id, owner_id) {
        const db = await this.db.getDb();
        await db.collection('oauth2_apps').deleteOne({ client_id, owner_id });
    }
    async updateApp(client_id, owner_id, update) {
        const db = await this.db.getDb();
        const set = {};
        if (update.name !== undefined)
            set.name = update.name;
        if (update.redirect_urls !== undefined)
            set.redirect_urls = update.redirect_urls;
        if (Object.keys(set).length === 0)
            return;
        await db.collection('oauth2_apps').updateOne({ client_id, owner_id }, { $set: set });
    }
    async getUserByCode(code, client_id) {
        const db = await this.db.getDb();
        const result = await db.collection('oauth2_codes').aggregate([
            { $match: { code, client_id } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'user_id',
                    foreignField: 'user_id',
                    as: 'userData'
                }
            },
            { $unwind: '$userData' },
            { $replaceRoot: { newRoot: '$userData' } },
            { $project: { _id: 0 } }
        ]).toArray();
        return result[0] || null;
    }
}
exports.OAuth2Repository = OAuth2Repository;
function buildUpdateFields(obj, mapping = {}) {
    const fields = [];
    const values = [];
    for (const key in obj) {
        if (typeof obj[key] === 'undefined')
            continue;
        fields.push(`${key} = ?`);
        values.push(mapping[key] ? mapping[key](obj[key]) : obj[key]);
    }
    return { fields, values };
}
