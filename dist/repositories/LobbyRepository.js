"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobbyRepository = void 0;
class LobbyRepository {
    constructor(databaseService) {
        this.databaseService = databaseService;
    }
    async getLobbies(filters = {}) {
        const db = await this.databaseService.getDb();
        const query = {};
        if (filters.lobbyId)
            query.lobbyId = filters.lobbyId;
        if (filters.userId)
            query.users = filters.userId;
        const rows = await db.collection('lobbies').find(query).toArray();
        const lobbies = [];
        for (const row of rows) {
            const users = await this.getUsersByIds(row.users);
            lobbies.push({
                lobbyId: row.lobbyId,
                users,
            });
        }
        return lobbies;
    }
    async getLobby(lobbyId) {
        const lobbies = await this.getLobbies({ lobbyId });
        return lobbies[0] || null;
    }
    async getUserLobby(userId) {
        const lobbies = await this.getLobbies({ userId });
        if (lobbies.length === 0)
            return null;
        return lobbies ? { lobbyId: lobbies[0].lobbyId, users: lobbies[0].users } : null;
    }
    async getUserLobbies(userId) {
        return this.getLobbies({ userId });
    }
    async createLobby(lobbyId, users = []) {
        const db = await this.databaseService.getDb();
        await db.collection('lobbies').insertOne({ lobbyId, users });
    }
    async updateLobbyUsers(lobbyId, users) {
        const db = await this.databaseService.getDb();
        const usersIds = await this.getUsersIdOnly(users);
        await db.collection('lobbies').updateOne({ lobbyId }, { $set: { users: usersIds } });
    }
    async deleteLobby(lobbyId) {
        const db = await this.databaseService.getDb();
        await db.collection('lobbies').deleteOne({ lobbyId });
    }
    async getUsersByIds(userIds) {
        if (!userIds || userIds.length === 0)
            return [];
        const db = await this.databaseService.getDb();
        const result = await db.collection('users').find({ user_id: { $in: userIds }, disabled: 0 }).project({ user_id: 1, username: 1, verified: 1, admin: 1, badges: 1, beta_user: 1, created_at: 1, updated_at: 1, _id: 0 }).toArray();
        // const result = await this.databaseService.read<PublicUser[]>(`SELECT user_id, username, verified, admin FROM users WHERE user_id IN (?) AND disabled = 0`, [userIds]);
        const users = result.map(doc => ({
            user_id: doc.user_id,
            username: doc.username,
            verified: doc.verified,
            admin: doc.admin,
            badges: doc.badges || [],
            beta_user: doc.beta_user || false,
            created_at: doc.created_at,
            updated_at: doc.updated_at,
            isStudio: doc.isStudio || false,
        }));
        return users;
    }
    async getUsersIdOnly(users) {
        return users.map(user => user.user_id);
    }
}
exports.LobbyRepository = LobbyRepository;
