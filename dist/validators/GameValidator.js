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
    genre: yup.string().required("Genre is required"),
    releaseDate: yup.date().required("Release date is required"),
    // Add other fields as needed
});
// Schema for updating a game (fields can be optional)
exports.updateGameBodySchema = yup.object({
    name: yup.string(),
    genre: yup.string(),
    releaseDate: yup.date(),
    // Add other fields as needed
}).noUnknown();
