import { Lobby } from "../interfaces/Lobbies";
import { PublicUser } from "../interfaces/User";
import { IDatabaseService } from "../services/DatabaseService";
export declare class LobbyRepository {
    private databaseService;
    constructor(databaseService: IDatabaseService);
    getLobbies(filters?: {
        lobbyId?: string;
        userId?: string;
    }): Promise<Lobby[]>;
    getLobby(lobbyId: string): Promise<Lobby | null>;
    getUserLobby(userId: string): Promise<Lobby | null>;
    getUserLobbies(userId: string): Promise<Lobby[]>;
    createLobby(lobbyId: string, users?: string[]): Promise<void>;
    updateLobbyUsers(lobbyId: string, users: PublicUser[]): Promise<void>;
    deleteLobby(lobbyId: string): Promise<void>;
    private getUsersByIds;
    private getUsersIdOnly;
}

