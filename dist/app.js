"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const compression_1 = __importDefault(require("compression"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = require("dotenv");
const express_1 = __importDefault(require("express"));
const inversify_express_utils_1 = require("inversify-express-utils");
require("reflect-metadata");
const container_1 = __importDefault(require("./container"));
(0, dotenv_1.config)();
require("./controllers/AuthenticatorController");
require("./controllers/BuyOrderController");
require("./controllers/DescribeController");
require("./controllers/GameController");
require("./controllers/GameGiftController");
require("./controllers/InventoryController");
require("./controllers/ItemController");
require("./controllers/LobbyController");
require("./controllers/MarketListingController");
require("./controllers/OAuth2Controller");
require("./controllers/SearchController");
require("./controllers/StripeController");
require("./controllers/StudioController");
require("./controllers/TradeController");
require("./controllers/UserController");
require("./controllers/WebAuthnController");
const server = new inversify_express_utils_1.InversifyExpressServer(container_1.default);
server.setConfig(app => {
    app.use('/stripe/webhook', express_1.default.raw({ type: 'application/json' }));
    app.use(express_1.default.json({ limit: '50mb' }));
    app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
    app.use((0, cors_1.default)());
    app.use((0, compression_1.default)({
        threshold: 1024,
    }));
});
server.setErrorConfig(app => {
    app.use((req, res) => {
        res.status(404).json({ message: 'Not Found' });
    });
});
exports.app = server.build();
