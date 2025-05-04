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
export declare class LobbyService implements ILobbyService {
    private databaseService;
    constructor(databaseService: IDatabaseService);
    getLobby(lobbyId: string): Promise<Lobby | null>;
    joinLobby(lobbyId: string, userId: string): Promise<void>;
    leaveLobby(lobbyId: string, userId: string): Promise<void>;
    getUserLobby(userId: string): Promise<Lobby | null>;
    createLobby(lobbyId: string, users?: string[]): Promise<void>;
    deleteLobby(lobbyId: string): Promise<void>;
}
