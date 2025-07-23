"use strict";
// src/utils/searchHelpers.ts
// Regroupe les helpers utilisés par SearchController
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatInventory = exports.filterGame = exports.mapItem = exports.mapUserSearch = exports.mapUser = exports.requireFields = exports.findUserByResetToken = exports.sendError = void 0;
function sendError(res, status, message, error) {
    return res.status(status).send({ message, error });
}
exports.sendError = sendError;
function findUserByResetToken(users, reset_token) {
    return users.find((u) => u.forgot_password_token === reset_token);
}
exports.findUserByResetToken = findUserByResetToken;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function requireFields(obj, fields) {
    for (const f of fields)
        if (!obj[f])
            return f;
    return null;
}
exports.requireFields = requireFields;
function mapUser(user) {
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
exports.mapUser = mapUser;
function mapUserSearch(user) {
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
exports.mapUserSearch = mapUserSearch;
function mapItem(item) {
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
exports.mapItem = mapItem;
function filterGame(game, userId, myId) {
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
exports.filterGame = filterGame;
async function formatInventory(inventory, itemService) {
    const seen = new Set();
    return (await Promise.all(inventory
        .filter((item) => {
        if (seen.has(item.item_id))
            return false;
        seen.add(item.item_id);
        return true;
    })
        .map(async (item) => {
        const itemDetails = await itemService.getItem(item.item_id);
        if (!itemDetails || itemDetails.deleted)
            return null;
        return {
            itemId: itemDetails.itemId,
            name: itemDetails.name,
            description: itemDetails.description,
            amount: item.amount,
            iconHash: itemDetails.iconHash,
        };
    }))).filter(Boolean);
}
exports.formatInventory = formatInventory;
