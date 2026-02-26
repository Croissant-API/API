import { config } from 'dotenv';
import 'reflect-metadata';
import container from './container';
config();

import './controllers/AuthenticatorController';
import './controllers/BuyOrderController';
import './controllers/DescribeController';
import './controllers/GameController';
import './controllers/GameGiftController';
import './controllers/InventoryController';
import './controllers/ItemController';
import './controllers/LobbyController';
import './controllers/MarketListingController';
import './controllers/OAuth2Controller';
import './controllers/SearchController';
import './controllers/StripeController';
import './controllers/StudioController';
import './controllers/TradeController';
import './controllers/UserController';
import './controllers/WebAuthnController';
import { InversifyHonoServer } from './hono-inversify';

// const server = new InversifyExpressServer(container);
const server = new InversifyHonoServer(container);


server.setConfig(app => {
  // app.use('/stripe/webhook', express.raw({ type: 'application/json' }));
  // app.use(express.json({ limit: '50mb' }));
  // app.use(express.urlencoded({ limit: '50mb', extended: true }));
  // app.use(cors());

  app.use('*', async (c: any, next: any) => {
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

export const app = server.build();


