import { IDatabaseService } from "./DatabaseService";
import { Lobby } from "../interfaces/Lobbies";
import { IUserService } from "./UserService";
interface LobbyUser {
    username: string;
    user_id: string;
    verified: boolean;
    steam_username?: string;
    steam_avatar_url?: string;
    steam_id?: string;
}
export interface ILobbyService {
    getLobby(lobbyId: string): Promise<Lobby | null>;
    getFormattedLobby(lobbyId: string): Promise<{
        lobbyId: string;
        users: LobbyUser[];
    } | null>;
    joinLobby(lobbyId: string, userId: string): Promise<void>;
    leaveLobby(lobbyId: string, userId: string): Promise<void>;
    getUserLobby(userId: string): Promise<{
        lobbyId: string;
        users: LobbyUser[];
    } | null>;
    getFormattedLobbyUsers(userIds: string[]): Promise<LobbyUser[]>;
    createLobby(lobbyId: string, users?: string[]): Promise<void>;
    deleteLobby(lobbyId: string): Promise<void>;
    getUserLobbies(userId: string): Promise<{
        lobbyId: string;
        users: string;
    }[]>;
    leaveAllLobbies(userId: string): Promise<void>;
}
export declare class LobbyService implements ILobbyService {
    private databaseService;
    private userService;
    constructor(databaseService: IDatabaseService, userService: IUserService);
    getLobby(lobbyId: string): Promise<Lobby | null>;
    getFormattedLobby(lobbyId: string): Promise<{
        lobbyId: string;
        users: LobbyUser[];
    } | null>;
    joinLobby(lobbyId: string, userId: string): Promise<void>;
    leaveLobby(lobbyId: string, userId: string): Promise<void>;
    getUserLobby(userId: string): Promise<{
        lobbyId: string;
        users: LobbyUser[];
    } | null>;
    getFormattedLobbyUsers(userIds: string[]): Promise<LobbyUser[]>;
    createLobby(lobbyId: string, users?: string[]): Promise<void>;
    deleteLobby(lobbyId: string): Promise<void>;
    getUserLobbies(userId: string): Promise<{
        lobbyId: string;
        users: string;
    }[]>;
    leaveAllLobbies(userId: string): Promise<void>;
}
export {};
