import { Game } from "../interfaces/Game";
import { IDatabaseService } from "../services/DatabaseService";
export declare class GameRepository {
    private databaseService;
    constructor(databaseService: IDatabaseService);
    getGame(gameId: string): Promise<Game | null>;
    getGameForPublic(gameId: string): Promise<Game | null>;
    getGameForOwner(gameId: string, userId: string): Promise<Game | null>;
    getUserGames(userId: string): Promise<Game[]>;
    listGames(): Promise<Game[]>;
    getStoreGames(): Promise<Game[]>;
    getMyCreatedGames(userId: string): Promise<Game[]>;
    getUserOwnedGames(userId: string): Promise<Game[]>;
    searchGames(query: string): Promise<Game[]>;
    createGame(game: Omit<Game, "id">): Promise<void>;
    updateGame(gameId: string, fields: string[], values: unknown[]): Promise<void>;
    deleteGame(gameId: string): Promise<void>;
    addOwner(gameId: string, ownerId: string): Promise<void>;
    removeOwner(gameId: string, ownerId: string): Promise<void>;
}
