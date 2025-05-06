import * as yup from 'yup';

// Schema for validating :gameId param (assuming it's a string, e.g., UUID or MongoDB ObjectId)
export const gameIdParamSchema = yup.object({
    gameId: yup.string().required("gameId is required"),
});

// Schema for creating a game (adjust fields as per your Game model)
export const createGameBodySchema = yup.object({
    name: yup.string().required("Game name is required"),
    description: yup.string().required("Description is required"),
    price: yup.number().required("Price is required"),
    downloadLink: yup.string().url("Download link must be a valid URL").required("Download link is required"),
    image: yup.string().required("Image is required"), // base64 string
    // genre: yup.string(), // Ajoutez si besoin
    // releaseDate: yup.date(), // Ajoutez si besoin
});

// Schema for updating a game (fields can be optional)
export const updateGameBodySchema = yup.object({
    name: yup.string(),
    genre: yup.string(),
    releaseDate: yup.date(),
    // Add other fields as needed
}).noUnknown();