import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { Game } from "../interfaces/Game";

export interface IGameService {
    getGame(gameId: string): Promise<Game | null>;
    listGames(): Promise<Game[]>;
    createGame(game: Omit<Game, "id">): Promise<void>;
    updateGame(gameId: string, game: Partial<Omit<Game, "id" | "gameId">>): Promise<void>;
    deleteGame(gameId: string): Promise<void>;
}

@injectable()
export class GameService implements IGameService {
    constructor(
        @inject("DatabaseService") private databaseService: IDatabaseService
    ) {}

    async getGame(gameId: string): Promise<Game | null> {
        const rows = await this.databaseService.read<Game[]>(
            "SELECT * FROM games WHERE gameId = ?",
            [gameId]
        );
        return rows.length > 0 ? rows[0] : null;
    }

    async listGames(): Promise<Game[]> {
        return await this.databaseService.read<Game[]>(
            "SELECT * FROM games"
        );
    }

    async createGame(game: Omit<Game, "id">): Promise<void> {
        await this.databaseService.update(
            "INSERT INTO games (gameId, name, description, price, ownerId, showInStore) VALUES (?, ?, ?, ?, ?, ?)",
            [
                game.gameId,
                game.name,
                game.description,
                game.price,
                game.ownerId,
                game.showInStore ? 1 : 0
            ]
        );
    }

    async updateGame(gameId: string, game: Partial<Omit<Game, "id" | "gameId">>): Promise<void> {
        const fields = [];
        const values = [];
        for (const key in game) {
            fields.push(`${key} = ?`);
            values.push(
                key === "showInStore"
                    ? (game[key as keyof typeof game] ? 1 : 0)
                    : game[key as keyof typeof game]
            );
        }
        if (fields.length === 0) return;
        values.push(gameId);
        await this.databaseService.update(
            `UPDATE games SET ${fields.join(", ")} WHERE gameId = ?`,
            values
        );
    }

    async deleteGame(gameId: string): Promise<void> {
        await this.databaseService.update(
            "DELETE FROM games WHERE gameId = ?",
            [gameId]
        );
    }
}
