import { Lobby } from "../interfaces/Lobbies";
import { IDatabaseService } from "./DatabaseService";
import { UserService } from "./UserService";
export interface ILobbyService {
    getLobby(lobbyId: string): Promise<Lobby | null>;
    joinLobby(lobbyId: string, userId: string): Promise<void>;
    leaveLobby(lobbyId: string, userId: string): Promise<void>;
    getUserLobby(userId: string): Promise<Lobby | null>;
    createLobby(lobbyId: string, users?: string[]): Promise<void>;
    deleteLobby(lobbyId: string): Promise<void>;
    getUserLobbies(userId: string): Promise<Lobby[]>;
    leaveAllLobbies(userId: string): Promise<void>;
}
export declare class LobbyService implements ILobbyService {
    private databaseService;
    private userService;
    private lobbyRepository;
    constructor(databaseService: IDatabaseService, userService: UserService);
    getLobby(lobbyId: string): Promise<Lobby | null>;
    joinLobby(lobbyId: string, userId: string): Promise<void>;
    leaveLobby(lobbyId: string, userId: string): Promise<void>;
    getUserLobby(userId: string): Promise<Lobby | null>;
    createLobby(lobbyId: string, users?: string[]): Promise<void>;
    deleteLobby(lobbyId: string): Promise<void>;
    getUserLobbies(userId: string): Promise<Lobby[]>;
    leaveAllLobbies(userId: string): Promise<void>;
}

