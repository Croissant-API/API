import { config } from 'dotenv';
import { cors } from 'hono/cors';
import 'reflect-metadata';
import container from './container';
import { InversifyHonoServer } from './hono-inversify';
import './polyfills';
config();

import './controllers/TestController';
// TODO: Migrate these controllers to Hono
// import './controllers/AuthenticatorController';
// import './controllers/BuyOrderController';
// import './controllers/DescribeController';
// import './controllers/GameController';
// import './controllers/GameGiftController';
// import './controllers/InventoryController';
// import './controllers/ItemController';
// import './controllers/LobbyController';
// import './controllers/MarketListingController';
// import './controllers/OAuth2Controller';
// import './controllers/SearchController';
// import './controllers/StripeController';
// import './controllers/StudioController';
// import './controllers/TradeController';
// import './controllers/UserController';
// import './controllers/WebAuthnController';

const server = new InversifyHonoServer(container);

server.setConfig(app => {
  // Add CORS middleware
  app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'PATCH'],
  }));

  // Middleware for raw JSON for Stripe webhooks
  app.use('/stripe/webhook', async (c, next) => {
    // For Hono in Cloudflare Workers, raw body handling is different
    // We'll handle this in the specific Stripe controller
    await next();
  });

  // JSON parsing is handled automatically by Hono
  // No need for custom JSON parser middleware
});

server.setErrorConfig(app => {
  // 404 handler - this should be the last middleware
  app.notFound((c) => {
    return c.json({ message: 'Not Found' }, 404);
  });
});

export const app = server.build();


