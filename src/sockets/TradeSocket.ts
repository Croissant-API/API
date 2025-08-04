
import { Server, Socket } from 'socket.io';
import { TradeService, ITradeService } from '../services/TradeService';
import { injectable, inject } from 'inversify';
import { TradeItem } from '../interfaces/Trade';

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
                cb: (response: any) => void
            ) => {
                try {
                    const trade = await this.tradeService.startOrGetPendingTrade(fromUserId, toUserId);
                    cb?.({ success: true, trade });
                } catch (err: any) {
                    cb?.({ success: false, error: err.message });
                }
            });

            // Récupérer une trade par ID
            socket.on('trade:getById', async ({ tradeId }: { tradeId: string }, cb: (response: any) => void) => {
                try {
                    const trade = await this.tradeService.getFormattedTradeById(tradeId);
                    cb?.({ success: true, trade });
                } catch (err: any) {
                    cb?.({ success: false, error: err.message });
                }
            });

            // Ajouter un item à la trade
            socket.on('trade:addItem', async ({ tradeId, userId, tradeItem }: { tradeId: string, userId: string, tradeItem: TradeItem }, cb) => {
                try {
                    await this.tradeService.addItemToTrade(tradeId, userId, tradeItem);
                    const updatedTrade = await this.tradeService.getFormattedTradeById(tradeId);
                    this.io.to(tradeId).emit('trade:updated', updatedTrade);
                    cb?.({ success: true });
                } catch (err: any) {
                    cb?.({ success: false, error: err.message });
                }
            });

            // Retirer un item de la trade
            socket.on('trade:removeItem', async ({ tradeId, userId, tradeItem }: { tradeId: string, userId: string, tradeItem: TradeItem }, cb) => {
                try {
                    await this.tradeService.removeItemFromTrade(tradeId, userId, tradeItem);
                    const updatedTrade = await this.tradeService.getFormattedTradeById(tradeId);
                    this.io.to(tradeId).emit('trade:updated', updatedTrade);
                    cb?.({ success: true });
                } catch (err: any) {
                    cb?.({ success: false, error: err.message });
                }
            });

            // Approuver la trade
            socket.on('trade:approve', async (
                { tradeId, userId }: { tradeId: string; userId: string },
                cb: (response: any) => void
            ) => {
                try {
                    await this.tradeService.approveTrade(tradeId, userId);
                    const updatedTrade = await this.tradeService.getFormattedTradeById(tradeId);
                    this.io.to(tradeId).emit('trade:updated', updatedTrade);
                    if (updatedTrade?.status === 'completed') {
                        this.io.to(tradeId).emit('trade:completed', updatedTrade);
                    }
                    cb?.({ success: true });
                } catch (err: any) {
                    cb?.({ success: false, error: err.message });
                }
            });

            // Annuler la trade
            socket.on('trade:cancel', async (
                { tradeId, userId }: { tradeId: string; userId: string },
                cb: (response: any) => void
            ) => {
                try {
                    await this.tradeService.cancelTrade(tradeId, userId);
                    const updatedTrade = await this.tradeService.getFormattedTradeById(tradeId);
                    this.io.to(tradeId).emit('trade:updated', updatedTrade);
                    this.io.to(tradeId).emit('trade:canceled', updatedTrade);
                    cb?.({ success: true });
                } catch (err: any) {
                    cb?.({ success: false, error: err.message });
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