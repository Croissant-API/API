import "reflect-metadata";
import { InversifyExpressServer } from "inversify-express-utils";
import container from "./container";
import * as path from "path";
import express from "express";

import "./controllers/ItemController";
import "./controllers/UserController";
import "./controllers/InventoryController";

const server = new InversifyExpressServer(container);

server.setConfig((app) => {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(express.static(path.join(__dirname, "public")));
});

export const app = server.build();