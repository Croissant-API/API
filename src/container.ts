import { Container } from "inversify";

import { IItemService, ItemService } from "./services/ItemService";
import { DatabaseService, IDatabaseService } from "./services/database";
import { IUserService, UserService } from "./services/UserService";
import { IInventoryService, InventoryService } from "./services/InventoryService";
import { ILobbyService, LobbyService } from "./services/LobbyService";
import { ITradeService, TradeService } from "./services/TradeService";
import { IGameService, GameService } from "./services/GameService";

const container = new Container();

container.bind<IDatabaseService>("DatabaseService").to(DatabaseService).inSingletonScope();
container.bind<IInventoryService>("InventoryService").to(InventoryService).inSingletonScope();
container.bind<IItemService>("ItemService").to(ItemService).inSingletonScope();
container.bind<IUserService>("UserService").to(UserService).inSingletonScope();
container.bind<ILobbyService>("LobbyService").to(LobbyService).inSingletonScope();
container.bind<ITradeService>("TradeService").to(TradeService).inSingletonScope();
container.bind<IGameService>("GameService").to(GameService).inSingletonScope();

export default container;