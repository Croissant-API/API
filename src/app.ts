import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import { InversifyExpressServer } from 'inversify-express-utils';
import 'reflect-metadata';
import container from './container';
import './polyfills';
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

const server = new InversifyExpressServer(container);

server.setConfig(app => {
  // Use simpler middleware to avoid iconv-lite issues
  app.use('/stripe/webhook', express.raw({ type: 'application/json' }));
  
  // Custom JSON parser to avoid iconv-lite
  app.use((req, res, next) => {
    if (req.headers['content-type']?.includes('application/json')) {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          (req).body = JSON.parse(body);
        } catch {
          (req).body = {};
        }
        next();
      });
    } else {
      next();
    }
  });
  
  app.use(cors());
  // Skip compression for now to avoid dependency issues
  // app.use(
  //   compression({
  //     threshold: 1024, 
  //   })
  // );
});

server.setErrorConfig(app => {
  app.use((req, res) => {
    res.status(404).json({ message: 'Not Found' });
  });
});

export const app = server.build();


