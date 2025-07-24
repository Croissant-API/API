export interface BundleItem {
    id: string;
    amount: number;
    percent: number;
}
export interface Bundle {
    bundleId: string;
    price: number;
    items: BundleItem[];
    owner: string;
    deleted: boolean;
}
