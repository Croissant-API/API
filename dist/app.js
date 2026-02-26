"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
// dotenv is not loaded in the edge worker; environment variables are provided by Wrangler
require("reflect-metadata");
const container_1 = __importDefault(require("./container"));
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
const hono_inversify_1 = require("./hono-inversify");
// const server = new InversifyExpressServer(container);
const server = new hono_inversify_1.InversifyHonoServer(container_1.default);
server.setConfig(app => {
    // app.use('/stripe/webhook', express.raw({ type: 'application/json' }));
    // app.use(express.json({ limit: '50mb' }));
    // app.use(express.urlencoded({ limit: '50mb', extended: true }));
    // app.use(cors());
    app.use('*', async (c, next) => {
        c.res.headers.set('Access-Control-Allow-Origin', '*');
        c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (c.req.method === 'OPTIONS') {
            return c.text('', 200);
        }
        await next();
    });
    // app.use(
    //   compression({
    //     threshold: 1024, // Compress responses larger than 1KB
    //   })
    // );
});
// server.setErrorConfig(app => {
//   app.use((req: Request, res: any) => {
//     res.status(404).json({ message: 'Not Found' });
//   });
// });
exports.app = server.build();
