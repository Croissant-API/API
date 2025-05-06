"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateGameBodySchema = exports.createGameBodySchema = exports.gameIdParamSchema = void 0;
const yup = __importStar(require("yup"));
// Schema for validating :gameId param (assuming it's a string, e.g., UUID or MongoDB ObjectId)
exports.gameIdParamSchema = yup.object({
    gameId: yup.string().required("gameId is required"),
});
// Schema for creating a game (adjust fields as per your Game model)
exports.createGameBodySchema = yup.object({
    name: yup.string().required("Game name is required"),
    description: yup.string().required("Description is required"),
    price: yup.number().required("Price is required"),
    downloadLink: yup.string().url("Download link must be a valid URL").required("Download link is required"),
    image: yup.string().required("Image is required"), // base64 string
    // genre: yup.string(), // Ajoutez si besoin
    // releaseDate: yup.date(), // Ajoutez si besoin
});
// Schema for updating a game (fields can be optional)
exports.updateGameBodySchema = yup.object({
    name: yup.string(),
    genre: yup.string(),
    releaseDate: yup.date(),
    // Add other fields as needed
}).noUnknown();
