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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
require("reflect-metadata");
const inversify_express_utils_1 = require("inversify-express-utils");
const container_1 = __importDefault(require("./container"));
const path = __importStar(require("path"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
require("./controllers/DescribeController");
require("./controllers/GameController");
require("./controllers/InventoryController");
require("./controllers/ItemController");
require("./controllers/LobbyController");
require("./controllers/TradeController");
require("./controllers/UserController");
require("./controllers/OAuth2Controller");
require("./controllers/StudioController");
require("./controllers/SearchController");
require("./controllers/StripeController");
require("./controllers/WebAuthnController");
require("./controllers/AuthenticatorController");
require("./controllers/GameGiftController");
require("./controllers/MarketListingController");
require("./controllers/BuyOrderController");
const server = new inversify_express_utils_1.InversifyExpressServer(container_1.default);
server.setConfig((app) => {
    app.use('/stripe/webhook', express_1.default.raw({ type: 'application/json' }));
    app.use(express_1.default.json({ limit: "50mb" }));
    app.use(express_1.default.urlencoded({ limit: "50mb", extended: true }));
    app.use((0, cors_1.default)());
    app.use(express_1.default.static(path.join(__dirname, "public")));
});
// 404 handler
server.setErrorConfig((app) => {
    app.use((req, res) => {
        res.status(404).json({ message: "Not Found" });
    });
});
exports.app = server.build();
