import { IDatabaseService } from "./DatabaseService";
import { Lobby } from "../interfaces/Lobbies";
import { User } from "interfaces/User";
import { IUserService } from "./UserService";
export interface ILobbyService {
    getLobby(lobbyId: string): Promise<Lobby | null>;
    joinLobby(lobbyId: string, userId: string): Promise<void>;
    leaveLobby(lobbyId: string, userId: string): Promise<void>;
    getUserLobby(userId: string): Promise<{
        lobbyId: string;
        users: (User | null)[];
    } | null>;
    createLobby(lobbyId: string, users?: string[]): Promise<void>;
    deleteLobby(lobbyId: string): Promise<void>;
}
export declare class LobbyService implements ILobbyService {
    private databaseService;
    private userService;
    constructor(databaseService: IDatabaseService, userService: IUserService);
    getLobby(lobbyId: string): Promise<Lobby | null>;
    joinLobby(lobbyId: string, userId: string): Promise<void>;
    leaveLobby(lobbyId: string, userId: string): Promise<void>;
    getUserLobby(userId: string): Promise<{
        lobbyId: string;
        users: any[];
    } | null>;
    createLobby(lobbyId: string, users?: string[]): Promise<void>;
    deleteLobby(lobbyId: string): Promise<void>;
}
