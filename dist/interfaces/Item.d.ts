export interface Item {
    itemId: string;
    name: string;
    description: string;
    price: number;
    owner: string;
    showInStore: boolean;
    iconHash: string;
    deleted: boolean;
}
