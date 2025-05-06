export interface Game {
    id: number;
    gameId: string;
    name: string;
    description: string;
    price: number;
    ownerId: string;
    download_link: string;
    showInStore: boolean;
    image: string; // base64 string
}

export interface GameOwner {
    gameId: string;
    ownerId: string;
}