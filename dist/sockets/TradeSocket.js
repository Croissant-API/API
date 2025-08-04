"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeSocket = void 0;
const socket_io_1 = require("socket.io");
const inversify_1 = require("inversify");
const container_1 = __importDefault(require("../container"));
let TradeSocket = class TradeSocket {
    constructor(server) {
        this.io = server;
        // Utilise l'injection de dépendance pour TradeService
        this.tradeService = container_1.default.get('TradeService');
        this.initialize();
    }
    initialize() {
        this.io.on('connection', (socket) => {
            console.log('New client connected');
            // Démarrer ou récupérer une trade en attente
            socket.on('trade:startOrGetPending', async ({ fromUserId, toUserId }, cb) => {
                try {
                    const trade = await this.tradeService.startOrGetPendingTrade(fromUserId, toUserId);
                    cb?.({ success: true, trade });
                }
                catch (err) {
                    cb?.({ success: false, error: err.message });
                }
            });
            // Récupérer une trade par ID
            socket.on('trade:getById', async ({ tradeId }, cb) => {
                try {
                    const trade = await this.tradeService.getFormattedTradeById(tradeId);
                    cb?.({ success: true, trade });
                }
                catch (err) {
                    cb?.({ success: false, error: err.message });
                }
            });
            // Ajouter un item à la trade
            socket.on('trade:addItem', async ({ tradeId, userId, tradeItem }, cb) => {
                try {
                    await this.tradeService.addItemToTrade(tradeId, userId, tradeItem);
                    const updatedTrade = await this.tradeService.getFormattedTradeById(tradeId);
                    this.io.to(tradeId).emit('trade:updated', updatedTrade);
                    cb?.({ success: true });
                }
                catch (err) {
                    cb?.({ success: false, error: err.message });
                }
            });
            // Retirer un item de la trade
            socket.on('trade:removeItem', async ({ tradeId, userId, tradeItem }, cb) => {
                try {
                    await this.tradeService.removeItemFromTrade(tradeId, userId, tradeItem);
                    const updatedTrade = await this.tradeService.getFormattedTradeById(tradeId);
                    this.io.to(tradeId).emit('trade:updated', updatedTrade);
                    cb?.({ success: true });
                }
                catch (err) {
                    cb?.({ success: false, error: err.message });
                }
            });
            // Approuver la trade
            socket.on('trade:approve', async ({ tradeId, userId }, cb) => {
                try {
                    await this.tradeService.approveTrade(tradeId, userId);
                    const updatedTrade = await this.tradeService.getFormattedTradeById(tradeId);
                    this.io.to(tradeId).emit('trade:updated', updatedTrade);
                    if (updatedTrade?.status === 'completed') {
                        this.io.to(tradeId).emit('trade:completed', updatedTrade);
                    }
                    cb?.({ success: true });
                }
                catch (err) {
                    cb?.({ success: false, error: err.message });
                }
            });
            // Annuler la trade
            socket.on('trade:cancel', async ({ tradeId, userId }, cb) => {
                try {
                    await this.tradeService.cancelTrade(tradeId, userId);
                    const updatedTrade = await this.tradeService.getFormattedTradeById(tradeId);
                    this.io.to(tradeId).emit('trade:updated', updatedTrade);
                    this.io.to(tradeId).emit('trade:canceled', updatedTrade);
                    cb?.({ success: true });
                }
                catch (err) {
                    cb?.({ success: false, error: err.message });
                }
            });
            // Rejoindre une room de trade pour recevoir les updates
            socket.on('trade:joinRoom', ({ tradeId }) => {
                socket.join(tradeId);
            });
            // Quitter la room de trade
            socket.on('trade:leaveRoom', ({ tradeId }) => {
                socket.leave(tradeId);
            });
        });
    }
};
exports.TradeSocket = TradeSocket;
exports.TradeSocket = TradeSocket = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)('server')),
    __metadata("design:paramtypes", [typeof (_a = typeof socket_io_1.Server !== "undefined" && socket_io_1.Server) === "function" ? _a : Object])
], TradeSocket);
