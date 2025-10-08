import { inject, injectable } from "inversify";
import { GameViewStats } from "../interfaces/GameView";
import { GameViewRepository } from "../repositories/GameViewRepository";
import { IDatabaseService } from "./DatabaseService";

export interface IGameViewService {
  addView(gameId: string, viewerCookie: string, ipAddress: string, userAgent?: string): Promise<void>;
  hasViewedToday(gameId: string, viewerCookie: string): Promise<boolean>;
  getGameViewStats(gameId: string): Promise<GameViewStats>;
  getViewsForGames(gameIds: string[]): Promise<Record<string, GameViewStats>>;
  cleanupOldViews(daysToKeep?: number): Promise<void>;
}

@injectable()
export class GameViewService implements IGameViewService {
  private gameViewRepository: GameViewRepository;

  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService
  ) {
    this.gameViewRepository = new GameViewRepository(this.databaseService);
  }

  async addView(gameId: string, viewerCookie: string, ipAddress: string, userAgent?: string): Promise<void> {
    await this.gameViewRepository.addView(gameId, viewerCookie, ipAddress, userAgent);
  }

  async hasViewedToday(gameId: string, viewerCookie: string): Promise<boolean> {
    return this.gameViewRepository.hasViewedToday(gameId, viewerCookie);
  }

  async getGameViewStats(gameId: string): Promise<GameViewStats> {
    return this.gameViewRepository.getGameViewStats(gameId);
  }

  async getViewsForGames(gameIds: string[]): Promise<Record<string, GameViewStats>> {
    return this.gameViewRepository.getViewsForGames(gameIds);
  }

  async cleanupOldViews(daysToKeep: number = 365): Promise<void> {
    await this.gameViewRepository.cleanupOldViews(daysToKeep);
  }
}


