export interface Game {
  gameId: string;
  name: string;
  description: string;
  owner_id: string;
  download_link?: string | null;
  price: number;
  showInStore: boolean;
  iconHash?: string | null;
  splashHash?: string | null;
  bannerHash?: string | null;
  genre?: string | null;
  release_date?: string | null;
  developer?: string | null;
  publisher?: string | null;
  platforms?: string | null;
  rating: number;
  website?: string | null;
  trailer_link?: string | null;
  multiplayer: boolean;
}

export interface GameOwner {
  gameId: string;
  owner_id: string;
}
