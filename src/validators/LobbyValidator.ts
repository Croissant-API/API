import * as yup from "yup";

// Validator for lobbyId in params
export const lobbyIdParamSchema = yup.object({
    lobbyId: yup.string().trim().required("lobbyId is required"),
});

// Validator for userId in params
export const userIdParamSchema = yup.object({
    userId: yup.string().trim().required("userId is required"),
});