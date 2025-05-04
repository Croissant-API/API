export interface Lobby {
    id?: number;
    lobbyId: string; // Unique identifier for the lobby
    users: string; // Array of user IDs in the lobby
}