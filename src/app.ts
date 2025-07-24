import "reflect-metadata";
import { InversifyExpressServer } from "inversify-express-utils";
import container from "./container";
import * as path from "path";
import cors from "cors";
import express from "express";
import { config } from "dotenv";
config();

import "./controllers/DescribeController";
import "./controllers/GameController";
import "./controllers/InventoryController";
import "./controllers/ItemController";
import "./controllers/LobbyController";
import "./controllers/TradeController";
import "./controllers/UserController";
import "./controllers/OAuth2Controller";
import "./controllers/StudioController";
import "./controllers/SearchController";
import "./controllers/StripeController";

const server = new InversifyExpressServer(container);

server.setConfig((app) => {
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(cors());

  app.use(express.static(path.join(__dirname, "public")));
});

// 404 handler
server.setErrorConfig((app) => {
  app.use((req, res) => {
    res.status(404).json({ message: "Not Found" });
  });
});

export const app = server.build();
