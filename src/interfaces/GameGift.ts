export interface GameGift {
  id: string;
  gameId: string;
  fromUserId: string;
  toUserId?: string; // null si pas encore réclamé
  giftCode: string;
  createdAt: Date;
  claimedAt?: Date;
  isActive: boolean;
  message?: string;
}