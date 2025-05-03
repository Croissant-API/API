import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { Lobby } from "../interfaces/Lobbies";

export interface ILobbyService {
    getLobby(lobbyId: string): Promise<Lobby | null>;
    joinLobby(lobbyId: string, userId: string): Promise<void>;
    leaveLobby(lobbyId: string, userId: string): Promise<void>;
    getUserLobby(userId: string): Promise<Lobby | null>;
    createLobby(lobbyId: string, users?: string[]): Promise<void>;
    deleteLobby(lobbyId: string): Promise<void>;
}

@injectable()
export class LobbyService implements ILobbyService {
    constructor(
        @inject("DatabaseService") private databaseService: IDatabaseService
    ) {}

    async getLobby(lobbyId: string): Promise<Lobby | null> {
        const rows = await this.databaseService.read<Lobby[]>(
            "SELECT id, users FROM lobbies WHERE lobbyId = ?",
            [lobbyId]
        );
        if (rows.length === 0) return null;
        const row = rows[0];
        return row;
    }

    async joinLobby(lobbyId: string, userId: string): Promise<void> {
        const lobby = await this.getLobby(lobbyId);
        if (!lobby) throw new Error("Lobby not found");
        if (!lobby.users.includes(userId)) {
            lobby.users.push(userId);
            await this.databaseService.update(
                "UPDATE lobbies SET users = ? WHERE id = ?",
                [JSON.stringify(lobby.users), lobbyId]
            );
        }
    }

    async leaveLobby(lobbyId: string, userId: string): Promise<void> {
        const lobby = await this.getLobby(lobbyId);
        if (!lobby) throw new Error("Lobby not found");
        const newUsers = lobby.users.filter(u => u !== userId);
        if (newUsers.length === 0) {
            await this.deleteLobby(lobbyId);
        } else {
            await this.databaseService.update(
                "UPDATE lobbies SET users = ? WHERE id = ?",
                [JSON.stringify(newUsers), lobbyId]
            );
        }
    }

    async getUserLobby(userId: string): Promise<Lobby | null> {
        const rows = await this.databaseService.read<{ id: number, users: string }[]>(
            "SELECT id, users FROM lobbies"
        );
        for (const row of rows) {
            const users: string[] = JSON.parse(row.users);
            if (users.includes(userId)) {
                return { id: row.id, users };
            }
        }
        return null;
    }

    async createLobby(lobbyId: string, users: string[] = []): Promise<void> {
        await this.databaseService.update(
            "INSERT INTO lobbies (lobbyId, users) VALUES (?, ?)",
            [lobbyId, JSON.stringify(users)]
        );
    }

    async deleteLobby(lobbyId: string): Promise<void> {
        await this.databaseService.update(
            "DELETE FROM lobbies WHERE lobbyId = ?",
            [lobbyId]
        );
    }
}
