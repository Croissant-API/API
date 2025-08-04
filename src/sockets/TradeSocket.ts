import { Server, Socket } from 'socket.io';
import { TradeService, ITradeService } from '../services/TradeService';
import { injectable, inject } from 'inversify';
import { TradeItem, Trade } from '../interfaces/Trade';

interface TradeResponse {
    success: boolean;
    trade?: Trade | null;
    error?: string;
}

interface SuccessResponse {
    success: boolean;
}

interface ErrorResponse {
    success: false;
    error: string;
}

@injectable()
export class TradeSocket {
    private io: Server;
    private tradeService: ITradeService;

    constructor(
        @inject('server') server: Server,
        @inject('TradeService') tradeService: TradeService
    ) {
        this.io = server;
        // Utilise l'injection de dépendance pour TradeService
        this.tradeService = tradeService;
        this.initialize();
    }

    private initialize() {
        this.io.on('connection', (socket: Socket) => {
            console.log('New client connected');

            // Démarrer ou récupérer une trade en attente
            socket.on('trade:startOrGetPending', async (
                { fromUserId, toUserId }: { fromUserId: string; toUserId: string },
                cb: (response: TradeResponse) => void
            ) => {
                try {
                    const trade = await this.tradeService.startOrGetPendingTrade(fromUserId, toUserId);
                    cb?.({ success: true, trade });
                } catch (err: unknown) {
                    const error = err instanceof Error ? err.message : 'An unknown error occurred';
                    cb?.({ success: false, error: error });
                }
            });

            // Récupérer une trade par ID
            socket.on('trade:getById', async ({ tradeId }: { tradeId: string }, cb: (response: TradeResponse) => void) => {
                try {
                    const trade = await this.tradeService.getFormattedTradeById(tradeId);
                    cb?.({ success: true, trade });
                } catch (err: unknown) {
                    const error = err instanceof Error ? err.message : 'An unknown error occurred';
                    cb?.({ success: false, error: error });
                }
            });

            // Ajouter un item à la trade
            socket.on('trade:addItem', async ({ tradeId, userId, tradeItem }: { tradeId: string, userId: string, tradeItem: TradeItem }, cb: (response: SuccessResponse | ErrorResponse) => void) => {
                try {
                    await this.tradeService.addItemToTrade(tradeId, userId, tradeItem);
                    const updatedTrade = await this.tradeService.getFormattedTradeById(tradeId);
                    this.io.to(tradeId).emit('trade:updated', updatedTrade);
                    cb?.({ success: true });
                } catch (err: unknown) {
                    const error = err instanceof Error ? err.message : 'An unknown error occurred';
                    cb?.({ success: false, error: error });
                }
            });

            // Retirer un item de la trade
            socket.on('trade:removeItem', async ({ tradeId, userId, tradeItem }: { tradeId: string, userId: string, tradeItem: TradeItem }, cb: (response: SuccessResponse | ErrorResponse) => void) => {
                try {
                    await this.tradeService.removeItemFromTrade(tradeId, userId, tradeItem);
                    const updatedTrade = await this.tradeService.getFormattedTradeById(tradeId);
                    this.io.to(tradeId).emit('trade:updated', updatedTrade);
                    cb?.({ success: true });
                } catch (err: unknown) {
                    const error = err instanceof Error ? err.message : 'An unknown error occurred';
                    cb?.({ success: false, error: error });
                }
            });

            // Approuver la trade
            socket.on('trade:approve', async (
                { tradeId, userId }: { tradeId: string; userId: string },
                cb: (response: SuccessResponse | ErrorResponse) => void
            ) => {
                try {
                    await this.tradeService.approveTrade(tradeId, userId);
                    const updatedTrade = await this.tradeService.getFormattedTradeById(tradeId);
                    this.io.to(tradeId).emit('trade:updated', updatedTrade);
                    if (updatedTrade?.status === 'completed') {
                        this.io.to(tradeId).emit('trade:completed', updatedTrade);
                    }
                    cb?.({ success: true });
                } catch (err: unknown) {
                    const error = err instanceof Error ? err.message : 'An unknown error occurred';
                    cb?.({ success: false, error: error });
                }
            });

            // Annuler la trade
            socket.on('trade:cancel', async (
                { tradeId, userId }: { tradeId: string; userId: string },
                cb: (response: SuccessResponse | ErrorResponse) => void
            ) => {
                try {
                    await this.tradeService.cancelTrade(tradeId, userId);
                    const updatedTrade = await this.tradeService.getFormattedTradeById(tradeId);
                    this.io.to(tradeId).emit('trade:updated', updatedTrade);
                    this.io.to(tradeId).emit('trade:canceled', updatedTrade);
                    cb?.({ success: true });
                } catch (err: unknown) {
                    const error = err instanceof Error ? err.message : 'An unknown error occurred';
                    cb?.({ success: false, error: error });
                }
            });

            // Rejoindre une room de trade pour recevoir les updates
            socket.on('trade:joinRoom', ({ tradeId }: { tradeId: string }) => {
                socket.join(tradeId);
            });

            // Quitter la room de trade
            socket.on('trade:leaveRoom', ({ tradeId }: { tradeId: string }) => {
                socket.leave(tradeId);
            });
        });
    }
}