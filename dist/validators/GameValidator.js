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
exports.gameIdParamSchema = yup.object({
    gameId: yup.string().required('gameId is required'),
});
exports.createGameBodySchema = yup.object({
    name: yup.string().required('Game name is required'),
    description: yup.string().required('Description is required'),
    price: yup.number().required('Price is required'),
    download_link: yup.string().url('Download link must be a valid URL').nullable(),
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
    website: yup.string().url('Website must be a valid URL').nullable(),
    trailer_link: yup.string().url('Trailer link must be a valid URL').nullable(),
    multiplayer: yup.boolean().default(false),
});
exports.updateGameBodySchema = yup
    .object({
    name: yup.string(),
    description: yup.string(),
    price: yup.number(),
    download_link: yup.string().url('Download link must be a valid URL').nullable(),
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
    website: yup.string().url('Website must be a valid URL').nullable(),
    trailer_link: yup.string().url('Trailer link must be a valid URL').nullable(),
    multiplayer: yup.boolean(),
    markAsUpdated: yup.boolean(),
})
    .noUnknown();
