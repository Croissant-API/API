"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudioRepository = void 0;
class StudioRepository {
    constructor(db) {
        this.db = db;
    }
    parseUsers(users) {
        return Array.isArray(users) ? users : JSON.parse(users);
    }
    async getStudio(user_id) {
        const db = await this.db.getDb();
        const studio = await db.collection('studios').findOne({ user_id });
        if (!studio)
            return null;
        return {
            ...studio,
            users: studio.users,
            admin_id: studio.admin_id,
            user_id: studio.user_id,
            me: studio.user_id,
        };
    }
    async setStudioProperties(user_id, admin_id, userIds) {
        const db = await this.db.getDb();
        await db.collection('studios').updateOne({ user_id }, { $set: { admin_id, users: userIds } });
    }
    async getUserStudios(user_id) {
        const db = await this.db.getDb();
        const docs = await db.collection('studios').find({
            $or: [
                { admin_id: user_id },
                { users: user_id }
            ]
        }).toArray();
        // return docs.map(s => ({ ...s, users: this.parseUsers(s.users) }));
        const studios = [];
        for (const doc of docs) {
            const users = this.parseUsers(doc.users);
            studios.push({
                user_id: doc.user_id,
                admin_id: doc.admin_id,
                users,
            });
        }
        return studios;
    }
    async createStudio(user_id, admin_id) {
        const db = await this.db.getDb();
        await db.collection('studios').insertOne({ user_id, admin_id, users: [] });
    }
}
exports.StudioRepository = StudioRepository;
