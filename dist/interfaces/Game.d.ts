export interface Game {
    id: number;
    gameId: string;
    name: string;
    description: string;
    price: number;
    ownerId: string;
    showInStore: boolean;
}
export interface GameOwner {
    gameId: string;
    ownerId: string;
}
