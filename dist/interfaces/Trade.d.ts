export interface TradeItem {
    itemId: string;
    amount: number;
}
export interface Trade {
    id: number;
    fromUserId: string;
    toUserId: string;
    fromUserItems: TradeItem[];
    toUserItems: TradeItem[];
    approvedFromUser: boolean;
    approvedToUser: boolean;
    uniqueId: string;
    status: string;
}
