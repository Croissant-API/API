import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { Lobby } from "../interfaces/Lobbies";
import { User } from "interfaces/User";
import { IUserService } from "./UserService";

export interface ILobbyService {
    getLobby(lobbyId: string): Promise<Lobby | null>;
    joinLobby(lobbyId: string, userId: string): Promise<void>;
    leaveLobby(lobbyId: string, userId: string): Promise<void>;
    getUserLobby(userId: string): Promise<{ lobbyId: string, users: (User | null)[] } | null>;
    createLobby(lobbyId: string, users?: string[]): Promise<void>;
    deleteLobby(lobbyId: string): Promise<void>;
}

@injectable()
export class LobbyService implements ILobbyService {
    constructor(
        @inject("DatabaseService") private databaseService: IDatabaseService,
        @inject("UserService") private userService: IUserService
    ) { }

    async getLobby(lobbyId: string): Promise<Lobby | null> {
        const rows = await this.databaseService.read<Lobby[]>(
            "SELECT users FROM lobbies WHERE lobbyId = ?",
            [lobbyId]
        );
        if (rows.length === 0) return null;
        const row = rows[0];
        return row;
    }

    async joinLobby(lobbyId: string, userId: string): Promise<void> {
        const lobby = await this.getLobby(lobbyId);
        if (!lobby) throw new Error("Lobby not found");
        const users: string[] = JSON.parse(lobby.users);
        users.push(userId);
        const uniqueUsers = [...new Set(users)];
        await this.databaseService.update(
            "UPDATE lobbies SET users = ? WHERE lobbyId = ?",
            [JSON.stringify(uniqueUsers), lobbyId]
        );
    }

    async leaveLobby(lobbyId: string, userId: string): Promise<void> {
        const lobby = await this.getLobby(lobbyId);
        if (!lobby) throw new Error("Lobby not found");
        const newUsers = JSON.parse(lobby.users).filter((u: string) => u !== userId);
        if (newUsers.length === 0) {
            await this.deleteLobby(lobbyId);
        } else {
            await this.databaseService.update(
                "UPDATE lobbies SET users = ? WHERE lobbyId = ?",
                [JSON.stringify(newUsers), lobbyId]
            );
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getUserLobby(userId: string): Promise<{ lobbyId: string, users: any[] } | null> {
        const rows = await this.databaseService.read<{ lobbyId: string, users: string }[]>(
            "SELECT lobbyId, users FROM lobbies"
        );
        for (const row of rows) {
            const users: (User | null)[] = await Promise
                .all(JSON.parse(row.users).map((u: string) => this.userService.getUser(u)))
                .catch(() => []);
            if (users.find(user => user?.user_id === userId)) {
                // Si l'utilisateur fait partie de la lobby, on retourne la lobby
                return { lobbyId: row.lobbyId, users };
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
