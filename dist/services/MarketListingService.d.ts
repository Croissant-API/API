import { InventoryItem } from '../interfaces/Inventory';
import { MarketListing, EnrichedMarketListing } from '../interfaces/MarketListing';
import { DatabaseService } from './DatabaseService';
import { IBuyOrderService } from "./BuyOrderService";
export interface IMarketListingService {
    createMarketListing(...args: unknown[]): Promise<unknown>;
    cancelMarketListing(...args: unknown[]): Promise<unknown>;
    buyMarketListing(listingId: string, buyerId: string): Promise<MarketListing>;
    getMarketListingsByUser(userId: string): Promise<MarketListing[]>;
    getActiveListingsForItem(itemId: string): Promise<MarketListing[]>;
    getMarketListingById(listingId: string): Promise<MarketListing | null>;
    getEnrichedMarketListings(limit?: number, offset?: number): Promise<EnrichedMarketListing[]>;
    searchMarketListings(searchTerm: string, limit?: number): Promise<EnrichedMarketListing[]>;
}
export declare class MarketListingService implements IMarketListingService {
    private databaseService;
    private buyOrderService;
    private marketListingRepository;
    constructor(databaseService: DatabaseService, buyOrderService: IBuyOrderService);
    /**
     * Met un item de l'inventaire en vente sur le marketplace
     * L'item est retiré de l'inventaire et ajouté aux ordres de vente
     */
    createMarketListing(sellerId: string, inventoryItem: InventoryItem, sellingPrice: number): Promise<MarketListing>;
    /**
     * Annule un ordre de vente et remet l'item dans l'inventaire du vendeur
     */
    cancelMarketListing(listingId: string, sellerId: string): Promise<void>;
    buyMarketListing(listingId: string, buyerId: string): Promise<MarketListing>;
    /**
     * Récupère tous les ordres de vente d'un utilisateur
     */
    getMarketListingsByUser(userId: string): Promise<EnrichedMarketListing[]>;
    /**
     * Récupère tous les ordres de vente actifs pour un item spécifique
     */
    getActiveListingsForItem(itemId: string): Promise<MarketListing[]>;
    /**
     * Récupère un ordre de vente par son ID
     */
    getMarketListingById(listingId: string): Promise<MarketListing | null>;
    /**
     * Récupère les ordres de vente enrichis avec les détails des items
     */
    getEnrichedMarketListings(limit?: number, offset?: number): Promise<EnrichedMarketListing[]>;
    /**
     * Recherche d'ordres de vente par nom d'item
     */
    searchMarketListings(searchTerm: string, limit?: number): Promise<EnrichedMarketListing[]>;
    /**
     * Désérialise une ligne de la base de données en MarketListing
     */
    private deserializeMarketListing;
}
