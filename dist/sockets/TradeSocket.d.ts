import { Server } from 'socket.io';
export declare class TradeSocket {
    private io;
    private tradeService;
    constructor(server: Server);
    private initialize;
}
