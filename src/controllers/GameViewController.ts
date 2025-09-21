import { Request, Response } from "express";
import { inject } from "inversify";
import { controller, httpGet, httpPost } from "inversify-express-utils";
import { IGameViewService } from "../services/GameViewService";
import { ILogService } from "../services/LogService";
import { IGameService } from "../services/GameService";
import { v4 as uuidv4 } from "uuid";

// --- UTILS ---
function handleError(res: Response, error: unknown, message: string, status = 500) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(status).send({ message, error: msg });
}

function getViewerCookie(req: Request): string {
    let cookie = req.cookies?.viewer_id;
    if (!cookie) {
        cookie = uuidv4();
    }
    return cookie;
}

@controller("/game-views")
export class GameViewController {
    constructor(
        @inject("GameViewService") private gameViewService: IGameViewService,
        @inject("LogService") private logService: ILogService,
        @inject("GameService") private gameService: IGameService
    ) { }

    private async createLog(req: Request, action: string, tableName?: string, statusCode?: number, userId?: string) {
        try {
            await this.logService.createLog({
                ip_address: (req.headers["x-real-ip"] as string) || (req.socket.remoteAddress as string),
                table_name: tableName,
                controller: `GameViewController.${action}`,
                original_path: req.originalUrl,
                http_method: req.method,
                request_body: req.body,
                user_id: userId,
                status_code: statusCode,
            });
        } catch (error) {
            console.error("Error creating log:", error);
        }
    }

    @httpPost("/games/:gameId/view")
    public async addGameView(req: Request, res: Response) {
        const { gameId } = req.params;
        if (!gameId) {
            await this.createLog(req, "addGameView", "game_views", 400);
            return res.status(400).send({ message: "Game ID is required" });
        }

        try {
            const viewerCookie = getViewerCookie(req);
            const ipAddress = (req.headers["x-real-ip"] as string) || (req.socket.remoteAddress as string) || "unknown";
            const userAgent = req.headers["user-agent"];

            // Vérifier si l'utilisateur a déjà vu ce jeu aujourd'hui
            const hasViewedToday = await this.gameViewService.hasViewedToday(gameId, viewerCookie);
            
            if (!hasViewedToday) {
                await this.gameViewService.addView(gameId, viewerCookie, ipAddress, userAgent);
            }

            // Définir le cookie pour les futures visites
            res.cookie('viewer_id', viewerCookie, {
                maxAge: 365 * 24 * 60 * 60 * 1000, // 1 an
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax'
            });

            await this.createLog(req, "addGameView", "game_views", 200);
            res.status(200).send({ 
                message: "View recorded", 
                hasViewedToday,
                viewerCookie 
            });
        } catch (error) {
            await this.createLog(req, "addGameView", "game_views", 500);
            handleError(res, error, "Error recording view");
        }
    }

    @httpGet("/games/:gameId/views")
    public async getGameViewStats(req: Request, res: Response) {
        const { gameId } = req.params;
        if (!gameId) {
            await this.createLog(req, "getGameViewStats", "game_views", 400);
            return res.status(400).send({ message: "Game ID is required" });
        }

        try {
            const stats = await this.gameViewService.getGameViewStats(gameId);
            await this.createLog(req, "getGameViewStats", "game_views", 200);
            res.status(200).send(stats);
        } catch (error) {
            await this.createLog(req, "getGameViewStats", "game_views", 500);
            handleError(res, error, "Error fetching view stats");
        }
    }
}


