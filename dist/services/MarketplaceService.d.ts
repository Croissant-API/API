import { IDatabaseService } from "./DatabaseService";
import { IInventoryService } from "./InventoryService";
import { IUserService } from "./UserService";
import { IItemService } from "./ItemService";
import { MarketplaceSale, MarketplaceBuyOrder, MarketplaceTransaction } from "../interfaces/Marketplace";
export interface IMarketplaceService {
    createSale(sellerUserId: string, itemId: string, uniqueId: string | undefined, price: number): Promise<string>;
    cancelSale(saleId: string, userId: string): Promise<void>;
    createBuyOrder(buyerUserId: string, itemId: string, maxPrice: number): Promise<string>;
    cancelBuyOrder(orderId: string, userId: string): Promise<void>;
    getSalesByUser(userId: string): Promise<MarketplaceSale[]>;
    getBuyOrdersByUser(userId: string): Promise<MarketplaceBuyOrder[]>;
    getActiveSalesForItem(itemId: string): Promise<MarketplaceSale[]>;
    getActiveBuyOrdersForItem(itemId: string): Promise<MarketplaceBuyOrder[]>;
    getMarketplaceHistory(userId: string): Promise<MarketplaceTransaction[]>;
    searchAllItems(query: string): Promise<any[]>;
    getUserSellableItems(userId: string): Promise<any[]>;
    searchItems(query: string): Promise<any[]>;
}
export declare class MarketplaceService implements IMarketplaceService {
    private databaseService;
    private inventoryService;
    private userService;
    private itemService;
    constructor(databaseService: IDatabaseService, inventoryService: IInventoryService, userService: IUserService, itemService: IItemService);
    createSale(sellerUserId: string, itemId: string, uniqueId: string | undefined, price: number): Promise<string>;
    cancelSale(saleId: string, userId: string): Promise<void>;
    createBuyOrder(buyerUserId: string, itemId: string, maxPrice: number): Promise<string>;
    cancelBuyOrder(orderId: string, userId: string): Promise<void>;
    private matchSaleWithBuyOrders;
    private matchBuyOrderWithSales;
    private executeTrade;
    getSalesByUser(userId: string): Promise<MarketplaceSale[]>;
    getBuyOrdersByUser(userId: string): Promise<MarketplaceBuyOrder[]>;
    getActiveSalesForItem(itemId: string): Promise<MarketplaceSale[]>;
    getActiveBuyOrdersForItem(itemId: string): Promise<MarketplaceBuyOrder[]>;
    getMarketplaceHistory(userId: string): Promise<MarketplaceTransaction[]>;
    searchAllItems(query: string): Promise<any[]>;
    getUserSellableItems(userId: string): Promise<any[]>;
    searchItems(query: string): Promise<any[]>;
}
