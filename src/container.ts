import { Container } from "inversify";


import { IItemService, ItemService } from "./services/ItemService";
import { DatabaseService, IDatabaseService } from "./services/database";
import { IUserService, UserService } from "./services/UserService";
import { IInventoryService, InventoryService } from "./services/InventoryService";

const container = new Container();

container.bind<IDatabaseService>("DatabaseService").to(DatabaseService).inSingletonScope();
container.bind<IItemService>("ItemService").to(ItemService).inSingletonScope();
container.bind<IUserService>("UserService").to(UserService).inSingletonScope();
container.bind<IInventoryService>("InventoryService").to(InventoryService).inSingletonScope();

export default container;