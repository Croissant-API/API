/* eslint-disable @typescript-eslint/no-explicit-any */
import { Server, Socket } from 'socket.io';
import { injectable, inject } from 'inversify';
import { ILobbyService } from '../services/LobbyService';
import { ILogService } from '../services/LogService';

interface LobbyResponse {
    success: boolean;
    lobby?: any;
    error?: string;
}

interface SuccessResponse {
    success: boolean;
    message?: string;
}

interface ErrorResponse {
    success: false;
    error: string;
}

@injectable()
export class LobbySocket {
    constructor(
        @inject('LobbyService') private lobbyService: ILobbyService,
        @inject('LogService') private logService: ILogService
    ) {}

    initialize(io: Server) {
        io.on('connection', (socket: Socket) => {
            console.log('Client connected to lobby socket:', socket.id);

            // Rejoindre une room de lobby
            socket.on('lobby:join', ({ lobbyId }: { lobbyId: string }) => {
                socket.join(lobbyId);
                console.log(`Socket ${socket.id} joined lobby room: ${lobbyId}`);
            });

            // Quitter une room de lobby
            socket.on('lobby:leave', ({ lobbyId }: { lobbyId: string }) => {
                socket.leave(lobbyId);
                console.log(`Socket ${socket.id} left lobby room: ${lobbyId}`);
            });

            // Créer un lobby
            socket.on('lobby:create', async (
                { userId }: { userId: string },
                cb: (response: LobbyResponse) => void
            ) => {
                try {
                    const { v4 } = await import('uuid');
                    const lobbyId = v4();
                    
                    // Quitter tous les autres lobbies d'abord
                    await this.lobbyService.leaveAllLobbies(userId);
                    
                    // Créer et rejoindre le nouveau lobby
                    await this.lobbyService.createLobby(lobbyId, [userId]);
                    const lobby = await this.lobbyService.getLobby(lobbyId);
                    
                    // Faire rejoindre le socket à la room du lobby
                    socket.join(lobbyId);
                    
                    // Notifier les autres clients
                    io.to(lobbyId).emit('lobby:created', lobby);
                    
                    cb?.({ success: true, lobby });
                } catch (err: unknown) {
                    const error = err instanceof Error ? err.message : 'An unknown error occurred';
                    cb?.({ success: false, error });
                }
            });

            // Rejoindre un lobby existant
            socket.on('lobby:joinLobby', async (
                { lobbyId, userId }: { lobbyId: string; userId: string },
                cb: (response: SuccessResponse | ErrorResponse) => void
            ) => {
                try {
                    // Quitter tous les autres lobbies d'abord
                    await this.lobbyService.leaveAllLobbies(userId);
                    
                    // Rejoindre le lobby
                    await this.lobbyService.joinLobby(lobbyId, userId);
                    const updatedLobby = await this.lobbyService.getLobby(lobbyId);
                    
                    // Faire rejoindre le socket à la room du lobby
                    socket.join(lobbyId);
                    
                    // Notifier tous les clients dans ce lobby
                    io.to(lobbyId).emit('lobby:updated', updatedLobby);
                    
                    cb?.({ success: true, message: 'Joined lobby successfully' });
                } catch (err: unknown) {
                    const error = err instanceof Error ? err.message : 'An unknown error occurred';
                    cb?.({ success: false, error });
                }
            });

            // Quitter un lobby
            socket.on('lobby:leaveLobby', async (
                { lobbyId, userId }: { lobbyId: string; userId: string },
                cb: (response: SuccessResponse | ErrorResponse) => void
            ) => {
                try {
                    await this.lobbyService.leaveLobby(lobbyId, userId);
                    
                    // Quitter la room socket
                    socket.leave(lobbyId);
                    
                    // Vérifier si le lobby existe encore
                    const updatedLobby = await this.lobbyService.getLobby(lobbyId);
                    
                    if (updatedLobby) {
                        // Notifier les autres membres du lobby
                        io.to(lobbyId).emit('lobby:updated', updatedLobby);
                    } else {
                        // Le lobby a été supprimé (plus de membres)
                        io.to(lobbyId).emit('lobby:deleted', { lobbyId });
                    }
                    
                    cb?.({ success: true, message: 'Left lobby successfully' });
                } catch (err: unknown) {
                    const error = err instanceof Error ? err.message : 'An unknown error occurred';
                    cb?.({ success: false, error });
                }
            });

            // Obtenir les détails d'un lobby
            socket.on('lobby:get', async (
                { lobbyId }: { lobbyId: string },
                cb: (response: LobbyResponse) => void
            ) => {
                try {
                    const lobby = await this.lobbyService.getLobby(lobbyId);
                    if (!lobby) {
                        cb?.({ success: false, error: 'Lobby not found' });
                        return;
                    }
                    cb?.({ success: true, lobby });
                } catch (err: unknown) {
                    const error = err instanceof Error ? err.message : 'An unknown error occurred';
                    cb?.({ success: false, error });
                }
            });

            // Obtenir le lobby d'un utilisateur
            socket.on('lobby:getUserLobby', async (
                { userId }: { userId: string },
                cb: (response: LobbyResponse) => void
            ) => {
                try {
                    const lobby = await this.lobbyService.getUserLobby(userId);
                    cb?.({ success: true, lobby });
                } catch (err: unknown) {
                    const error = err instanceof Error ? err.message : 'An unknown error occurred';
                    cb?.({ success: false, error });
                }
            });

            socket.on('disconnect', () => {
                console.log('Client disconnected from lobby socket:', socket.id);
            });
        });
    }
}