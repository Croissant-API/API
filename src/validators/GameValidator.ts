import * as yup from 'yup';

// Schema for validating :gameId param (string, e.g., UUID)
export const gameIdParamSchema = yup.object({
    gameId: yup.string().required("gameId is required"),
});

// Schema for creating a game (fields as per Game interface and controller/service usage)
export const createGameBodySchema = yup.object({
    name: yup.string().required("Game name is required"),
    description: yup.string().required("Description is required"),
    price: yup.number().required("Price is required"),
    download_link: yup.string().url("Download link must be a valid URL").nullable(),
    showInStore: yup.boolean().default(false),
    iconHash: yup.string().nullable(),
    splashHash: yup.string().nullable(),
    bannerHash: yup.string().nullable(),
    genre: yup.string().nullable(),
    release_date: yup.string().nullable(),
    developer: yup.string().nullable(),
    publisher: yup.string().nullable(),
    platforms: yup.string().nullable(),
    rating: yup.number().default(0),
    website: yup.string().url("Website must be a valid URL").nullable(),
    trailer_link: yup.string().url("Trailer link must be a valid URL").nullable(),
    multiplayer: yup.boolean().default(false)
});

// Schema for updating a game (all fields optional, as per updateGame)
export const updateGameBodySchema = yup.object({
    name: yup.string(),
    description: yup.string(),
    price: yup.number(),
    download_link: yup.string().url("Download link must be a valid URL").nullable(),
    showInStore: yup.boolean(),
    iconHash: yup.string().nullable(),
    splashHash: yup.string().nullable(),
    bannerHash: yup.string().nullable(),
    genre: yup.string().nullable(),
    release_date: yup.string().nullable(),
    developer: yup.string().nullable(),
    publisher: yup.string().nullable(),
    platforms: yup.string().nullable(),
    rating: yup.number(),
    website: yup.string().url("Website must be a valid URL").nullable(),
    trailer_link: yup.string().url("Trailer link must be a valid URL").nullable(),
    multiplayer: yup.boolean(),
    markAsUpdated: yup.boolean()
}).noUnknown();