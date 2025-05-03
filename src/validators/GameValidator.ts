import * as yup from 'yup';

// Schema for validating :gameId param (assuming it's a string, e.g., UUID or MongoDB ObjectId)
export const gameIdParamSchema = yup.object({
    gameId: yup.string().required("gameId is required"),
});

// Schema for creating a game (adjust fields as per your Game model)
export const createGameBodySchema = yup.object({
    name: yup.string().required("Game name is required"),
    genre: yup.string().required("Genre is required"),
    releaseDate: yup.date().required("Release date is required"),
    // Add other fields as needed
});

// Schema for updating a game (fields can be optional)
export const updateGameBodySchema = yup.object({
    name: yup.string(),
    genre: yup.string(),
    releaseDate: yup.date(),
    // Add other fields as needed
}).noUnknown();