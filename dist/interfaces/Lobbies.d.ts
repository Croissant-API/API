import { PublicUser } from './User';
export interface Lobby {
    lobbyId: string;
    users: PublicUser[];
}
