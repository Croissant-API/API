"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketIO = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
const socket_io_1 = require("socket.io");
const http_1 = require("http");
const container_1 = __importDefault(require("./container"));
function setupSocketIO(app) {
    const server = (0, http_1.createServer)(app);
    const io = new socket_io_1.Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });
    // Bind Socket.IO server to container for dependency injection
    container_1.default.bind('SocketServer').toConstantValue(io);
    // Initialize lobby socket handlers
    const lobbySocket = container_1.default.get('LobbySocket');
    lobbySocket.initialize(io);
    return { server, io };
}
exports.setupSocketIO = setupSocketIO;
