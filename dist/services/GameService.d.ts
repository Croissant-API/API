import { IDatabaseService } from "./DatabaseService";
import { Game } from "../interfaces/Game";
export interface IGameService {
    getGame(gameId: string): Promise<Game | null>;
    listGames(): Promise<Game[]>;
    createGame(game: Omit<Game, "id">): Promise<void>;
    updateGame(gameId: string, game: Partial<Omit<Game, "id" | "gameId">>): Promise<void>;
    deleteGame(gameId: string): Promise<void>;
}
export declare class GameService implements IGameService {
    private databaseService;
    constructor(databaseService: IDatabaseService);
    getGame(gameId: string): Promise<Game | null>;
    listGames(): Promise<Game[]>;
    createGame(game: Omit<Game, "id">): Promise<void>;
    updateGame(gameId: string, game: Partial<Omit<Game, "id" | "gameId">>): Promise<void>;
    deleteGame(gameId: string): Promise<void>;
}
