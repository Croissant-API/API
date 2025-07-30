import { IDatabaseService } from "./DatabaseService";
import { Game } from "../interfaces/Game";
export interface IGameService {
    getUserGames(userId: string): Promise<Game[]>;
    getGame(gameId: string): Promise<Game | null>;
    listGames(): Promise<Game[]>;
    getStoreGames(): Promise<Game[]>;
    getMyCreatedGames(userId: string): Promise<Game[]>;
    getUserOwnedGames(userId: string): Promise<Game[]>;
    createGame(game: Omit<Game, "id">): Promise<void>;
    updateGame(gameId: string, game: Partial<Omit<Game, "id" | "gameId">>): Promise<void>;
    deleteGame(gameId: string): Promise<void>;
    addOwner(gameId: string, ownerId: string): Promise<void>;
    removeOwner(gameId: string, ownerId: string): Promise<void>;
    transferOwnership(gameId: string, newOwnerId: string): Promise<void>;
    searchGames(query: string): Promise<Game[]>;
    getGameForPublic(gameId: string): Promise<Game | null>;
    getGameForOwner(gameId: string, userId: string): Promise<Game | null>;
    canUserGiftGame(): Promise<boolean>;
    userOwnsGame(gameId: string, userId: string): Promise<boolean>;
    transferGameCopy(gameId: string, fromUserId: string, toUserId: string): Promise<void>;
    canTransferGame(gameId: string, fromUserId: string, toUserId: string): Promise<{
        canTransfer: boolean;
        reason?: string;
    }>;
}
export declare class GameService implements IGameService {
    private databaseService;
    constructor(databaseService: IDatabaseService);
    getGame(gameId: string): Promise<Game | null>;
    /**
     * Get game with public fields only (no download_link)
     */
    getGameForPublic(gameId: string): Promise<Game | null>;
    /**
     * Get game with download_link if user owns it or is the creator
     */
    getGameForOwner(gameId: string, userId: string): Promise<Game | null>;
    getUserGames(userId: string): Promise<Game[]>;
    listGames(): Promise<Game[]>;
    getStoreGames(): Promise<Game[]>;
    getMyCreatedGames(userId: string): Promise<Game[]>;
    getUserOwnedGames(userId: string): Promise<Game[]>;
    searchGames(query: string): Promise<Game[]>;
    createGame(game: Omit<Game, "id">): Promise<void>;
    updateGame(gameId: string, game: Partial<Omit<Game, "id" | "gameId">>): Promise<void>;
    deleteGame(gameId: string): Promise<void>;
    addOwner(gameId: string, ownerId: string): Promise<void>;
    removeOwner(gameId: string, ownerId: string): Promise<void>;
    transferOwnership(gameId: string, newOwnerId: string): Promise<void>;
    canUserGiftGame(): Promise<boolean>;
    userOwnsGame(gameId: string, userId: string): Promise<boolean>;
    transferGameCopy(gameId: string, fromUserId: string, toUserId: string): Promise<void>;
    canTransferGame(gameId: string, fromUserId: string, toUserId: string): Promise<{
        canTransfer: boolean;
        reason?: string;
    }>;
}
