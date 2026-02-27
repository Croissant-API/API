import 'reflect-metadata';
import container from './container'; // Use the existing container
import { AuthenticatorController } from './controllers/AuthenticatorController';
import { BuyOrderController } from './controllers/BuyOrderController';
import { DescribeController } from './controllers/DescribeController';
import { Games } from './controllers/GameController';
import { GameGifts } from './controllers/GameGiftController';
import { Inventories } from './controllers/InventoryController';
import { Items } from './controllers/ItemController';
import { Lobbies } from './controllers/LobbyController';
import { LogController } from './controllers/LogController';
import { MarketListingController } from './controllers/MarketListingController';
import { OAuth2Controller } from './controllers/OAuth2Controller';
import { SearchController } from './controllers/SearchController';
import { StripeController } from './controllers/StripeController';
import { Studios } from './controllers/StudioController';
import { Trades } from './controllers/TradeController';
import { Users } from './controllers/UserController';
import { WebAuthns } from './controllers/WebAuthnController';
import { InversifyHonoServer } from './hono-inversify/InversifyHonoServer';
console.log('Setting up container...');
// Bind controllers to the existing container
container.bind(Users).toSelf().inTransientScope();
container.bind(Items).toSelf().inTransientScope();
container.bind(Inventories).toSelf().inTransientScope();
container.bind(GameGifts).toSelf().inTransientScope();
container.bind(Games).toSelf().inTransientScope();
container.bind(DescribeController).toSelf().inTransientScope();
container.bind(BuyOrderController).toSelf().inTransientScope();
container.bind(AuthenticatorController).toSelf().inTransientScope();
container.bind(WebAuthns).toSelf().inTransientScope();
container.bind(Trades).toSelf().inTransientScope();
container.bind(Studios).toSelf().inTransientScope();
container.bind(StripeController).toSelf().inTransientScope();
container.bind(SearchController).toSelf().inTransientScope();
container.bind(OAuth2Controller).toSelf().inTransientScope();
container.bind(MarketListingController).toSelf().inTransientScope();
container.bind(LogController).toSelf().inTransientScope();
container.bind(Lobbies).toSelf().inTransientScope();
console.log('Container setup complete');
// Create the Hono-Inversify server
const server = new InversifyHonoServer(container);
// Optional configuration (global middlewares, etc.)
server.setConfig((app) => {
    // CORS middleware
    app.use('*', async (c, next) => {
        c.res.headers.set('Access-Control-Allow-Origin', '*');
        c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (c.req.method === 'OPTIONS') {
            return c.text('', 200);
        }
        await next();
    });
    app.use('*', async (c, next) => {
        // ensure the database client is initialised per request, passing whatever
        // environment the worker provides (Supabase URL/KEY will be pulled from
        // c.env inside the service).
        const dbService = container.get("DatabaseService");
        await dbService.initialize(c.env);
        await next();
    });
});
console.log('Building app...');
// Build the application
export const app = server.build();
console.log('App built successfully');
