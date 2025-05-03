import "reflect-metadata";
import { InversifyExpressServer } from "inversify-express-utils";
import container from "./container";
import * as path from "path";
import express from "express";
import { config } from "dotenv";
config();

import "./controllers/GameController";
import "./controllers/InventoryController";
import "./controllers/ItemController";
import "./controllers/LobbyController";
import "./controllers/TradeController";
import "./controllers/UserController";

const server = new InversifyExpressServer(container);

server.setConfig((app) => {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(express.static(path.join(__dirname, "public")));

  app.use("/*", (req, res) => {
    res.status(404)
       .send({ message: "API endpoint not found" });
  });
});

export const app = server.build();