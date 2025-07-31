export interface MarketListing {
    id: string; // UUID
    seller_id: string; // ID du vendeur
    item_id: string; // Référence vers l'item dans la table items
    price: number; // Prix fixé par le vendeur
    status: MarketListingStatus;
    metadata?: { [key: string]: unknown; _unique_id?: string }; // Métadonnées de l'item spécifique (pour items uniques)
    created_at: string; // ISO date
    updated_at: string; // ISO date
    sold_at?: string; // ISO date quand vendu (optionnel)
    buyer_id?: string; // ID de l'acheteur (optionnel, rempli quand vendu)
    purchasePrice?: number; // Prix d'achat de l'item (optionnel, pour historique)
}

export type MarketListingStatus = "active" | "sold" | "cancelled";

// Interface pour l'affichage enrichi avec les détails de l'item
export interface EnrichedMarketListing extends MarketListing {
    // Détails de l'item depuis la table items
    item_name: string;
    item_description: string;
    item_icon_hash: string;

    // Informations du vendeur (optionnel pour l'affichage)
    sellerName?: string;
}

// Interface pour créer un nouvel ordre de vente
export interface CreateMarketListingRequest {
    item_id: string;
    price: number;
    metadata?: { [key: string]: unknown; _unique_id?: string };
}