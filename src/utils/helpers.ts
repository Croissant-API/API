import { Response } from "express";
import { IItemService } from "../services/ItemService";
import { User } from "../interfaces/User";
import { Game } from "../interfaces/Game";

export function sendError(
    res: Response,
    status: number,
    message: string,
    error?: unknown
) {
    return res.status(status).send({ message, error });
}

export function findUserByResetToken(
    users: User[],
    reset_token: string
): User | undefined {
    return users.find((u) => u.forgot_password_token === reset_token);
}

export function requireFields(obj: object, fields: string[]): string | null {
    for (const f of fields) if (!(f in obj)) return f;
    return null;
}

export function mapUser(user: User) {
    return {
        id: user.user_id,
        userId: user.user_id,
        username: user.username,
        email: user.email,
        balance: user.balance !== undefined ? Math.floor(user.balance) : undefined,
        verified: !!user.verified,
        steam_id: user.steam_id,
        steam_username: user.steam_username,
        steam_avatar_url: user.steam_avatar_url,
        isStudio: !!user.isStudio,
        admin: !!user.admin,
        disabled: !!user.disabled,
    };
}

export function mapUserSearch(user: User) {
    return {
        id: user.user_id,
        userId: user.user_id,
        username: user.username,
        verified: user.verified,
        steam_id: user.steam_id,
        steam_username: user.steam_username,
        steam_avatar_url: user.steam_avatar_url,
        isStudio: user.isStudio,
        admin: !!user.admin,
    };
}

export function mapItem(item: {
    itemId: string;
    name: string;
    description: string;
    owner: string;
    price: number;
    iconHash?: string;
    showInStore?: boolean;
}) {
    return {
        itemId: item.itemId,
        name: item.name,
        description: item.description,
        owner: item.owner,
        price: item.price,
        iconHash: item.iconHash,
        ...(typeof item.showInStore !== "undefined" && {
            showInStore: item.showInStore,
        }),
    };
}

export function filterGame(game: Game, userId?: string, myId?: string) {
    return {
        gameId: game.gameId,
        name: game.name,
        description: game.description,
        price: game.price,
        owner_id: game.owner_id,
        showInStore: game.showInStore,
        iconHash: game.iconHash,
        splashHash: game.splashHash,
        bannerHash: game.bannerHash,
        genre: game.genre,
        release_date: game.release_date,
        developer: game.developer,
        publisher: game.publisher,
        platforms: game.platforms,
        rating: game.rating,
        website: game.website,
        trailer_link: game.trailer_link,
        multiplayer: game.multiplayer,
        ...(userId && game.owner_id === myId
            ? { download_link: game.download_link }
            : {}),
    };
}

export async function formatInventory(
    inventory: Array<{ item_id: string; amount: number }>,
    itemService: IItemService
) {
    const seen = new Set<string>();
    return (
        await Promise.all(
            inventory
                .filter((item) => {
                    if (seen.has(item.item_id)) return false;
                    seen.add(item.item_id);
                    return true;
                })
                .map(async (item) => {
                    const itemDetails = await itemService.getItem(item.item_id);
                    if (!itemDetails || itemDetails.deleted) return null;
                    return {
                        itemId: itemDetails.itemId,
                        name: itemDetails.name,
                        description: itemDetails.description,
                        amount: item.amount,
                        iconHash: itemDetails.iconHash,
                    };
                })
        )
    ).filter(Boolean);
}
