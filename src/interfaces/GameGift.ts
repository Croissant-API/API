export interface GameGift {
  id: string;
  gameId: string;
  fromUserId: string;
  toUserId?: string; 
  giftCode: string;
  createdAt: Date;
  claimedAt?: Date;
  isActive: boolean;
  message?: string;
}
