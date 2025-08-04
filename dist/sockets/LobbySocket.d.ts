import { Server } from 'socket.io';
import { ILobbyService } from '../services/LobbyService';
import { ILogService } from '../services/LogService';
export declare class LobbySocket {
    private lobbyService;
    private logService;
    constructor(lobbyService: ILobbyService, logService: ILogService);
    initialize(io: Server): void;
}
