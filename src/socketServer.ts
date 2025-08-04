/* eslint-disable @typescript-eslint/no-explicit-any */
import { Server } from 'socket.io';
import { createServer } from 'http';
import container from './container';
import { LobbySocket } from './sockets/LobbySocket';

export function setupSocketIO(app: any) {
    const server = createServer(app);
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    // Bind Socket.IO server to container for dependency injection
    container.bind<Server>('SocketServer').toConstantValue(io);

    // Initialize lobby socket handlers
    const lobbySocket = container.get<LobbySocket>('LobbySocket');
    lobbySocket.initialize(io);

    return { server, io };
}