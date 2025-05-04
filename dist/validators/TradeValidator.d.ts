import * as yup from "yup";
export declare const tradeItemSchema: yup.ObjectSchema<{
    itemId: string;
    amount: number;
}, yup.AnyObject, {
    itemId: undefined;
    amount: undefined;
}, "">;
export declare const tradeSchema: yup.ObjectSchema<{
    id: number;
    fromUserId: string;
    toUserId: string;
    fromUserItems: {
        itemId: string;
        amount: number;
    }[];
    toUserItems: {
        itemId: string;
        amount: number;
    }[];
    approvedFromUser: NonNullable<boolean | undefined>;
    approvedToUser: NonNullable<boolean | undefined>;
    status: NonNullable<"pending" | "completed" | "canceled" | undefined>;
}, yup.AnyObject, {
    id: undefined;
    fromUserId: undefined;
    toUserId: undefined;
    fromUserItems: "";
    toUserItems: "";
    approvedFromUser: undefined;
    approvedToUser: undefined;
    status: undefined;
}, "">;
export declare const tradeStatusSchema: yup.ObjectSchema<{
    status: NonNullable<"pending" | "completed" | "canceled" | undefined>;
}, yup.AnyObject, {
    status: undefined;
}, "">;
export declare const tradeApproveSchema: yup.ObjectSchema<{}, yup.AnyObject, {}, "">;
export declare const tradeItemActionSchema: yup.ObjectSchema<{
    userKey: NonNullable<"fromUserItems" | "toUserItems" | undefined>;
    tradeItem: {
        itemId: string;
        amount: number;
    };
}, yup.AnyObject, {
    userKey: undefined;
    tradeItem: {
        itemId: undefined;
        amount: undefined;
    };
}, "">;
