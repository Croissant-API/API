import { Server } from 'socket.io';
import { TradeService } from '../services/TradeService';
export declare class TradeSocket {
    private io;
    private tradeService;
    constructor(server: Server, tradeService: TradeService);
    private initialize;
}
