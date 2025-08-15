import { IDatabaseService } from "../services/DatabaseService";
export declare class LobbyRepository {
    private databaseService;
    constructor(databaseService: IDatabaseService);
    getLobby(lobbyId: string): Promise<{
        lobbyId: string;
        users: string[];
    } | null>;
    updateLobbyUsers(lobbyId: string, users: string[]): Promise<void>;
    getUserLobby(userId: string): Promise<{
        lobbyId: string;
        users: string[];
    } | null>;
    createLobby(lobbyId: string, users?: string[]): Promise<void>;
    deleteLobby(lobbyId: string): Promise<void>;
    getUserLobbies(userId: string): Promise<{
        lobbyId: string;
        users: string[];
    }[]>;
}
