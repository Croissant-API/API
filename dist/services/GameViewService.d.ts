import { GameViewStats } from '../interfaces/GameView';
import { IDatabaseService } from './DatabaseService';
export interface IGameViewService {
    addView(gameId: string, viewerCookie: string, ipAddress: string, userAgent?: string): Promise<void>;
    hasViewedToday(gameId: string, viewerCookie: string): Promise<boolean>;
    getGameViewStats(gameId: string): Promise<GameViewStats>;
    getViewsForGames(gameIds: string[]): Promise<Record<string, GameViewStats>>;
    cleanupOldViews(daysToKeep?: number): Promise<void>;
}
export declare class GameViewService implements IGameViewService {
    private databaseService;
    private gameViewRepository;
    constructor(databaseService: IDatabaseService);
    addView(gameId: string, viewerCookie: string, ipAddress: string, userAgent?: string): Promise<void>;
    hasViewedToday(gameId: string, viewerCookie: string): Promise<boolean>;
    getGameViewStats(gameId: string): Promise<GameViewStats>;
    getViewsForGames(gameIds: string[]): Promise<Record<string, GameViewStats>>;
    cleanupOldViews(daysToKeep?: number): Promise<void>;
}
