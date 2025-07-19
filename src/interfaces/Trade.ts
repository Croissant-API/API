export interface TradeItem {
    itemId: string;
    amount: number;
}

export type TradeStatus = "pending" | "approved" | "completed" | "canceled";

export interface Trade {
    id: string; // UUID
    fromUserId: string;
    toUserId: string;
    fromUserItems: TradeItem[];
    toUserItems: TradeItem[];
    approvedFromUser: boolean;
    approvedToUser: boolean;
    status: TradeStatus;
    createdAt: string; // ISO date
    updatedAt: string; // ISO date
}