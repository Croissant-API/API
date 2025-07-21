import { Container } from "inversify";

import { IItemService, ItemService } from "./services/ItemService";
import { DatabaseService, IDatabaseService } from "./services/DatabaseService";
import { IUserService, UserService } from "./services/UserService";
import { IInventoryService, InventoryService } from "./services/InventoryService";
import { ILobbyService, LobbyService } from "./services/LobbyService";
import { ITradeService, TradeService } from "./services/TradeService";
import { IGameService, GameService } from "./services/GameService";
import { OAuth2Service, IOAuth2Service } from "./services/OAuth2Service";
import { ISteamOAuthService, SteamOAuthService } from "./services/SteamOAuthService";
import { IMailService, MailService } from "./services/MailService";
import { IStudioService, StudioService } from "./services/StudioService";

const container = new Container();

container.bind<IDatabaseService>("DatabaseService").to(DatabaseService).inSingletonScope();
container.bind<IInventoryService>("InventoryService").to(InventoryService).inSingletonScope();
container.bind<IItemService>("ItemService").to(ItemService).inSingletonScope();
container.bind<IUserService>("UserService").to(UserService).inSingletonScope();
container.bind<ILobbyService>("LobbyService").to(LobbyService).inSingletonScope();
container.bind<ITradeService>("TradeService").to(TradeService).inSingletonScope();
container.bind<IGameService>("GameService").to(GameService).inSingletonScope();
container.bind<IOAuth2Service>("OAuth2Service").to(OAuth2Service).inSingletonScope();
container.bind<ISteamOAuthService>("SteamOAuthService").to(SteamOAuthService).inSingletonScope();
container.bind<IMailService>("MailService").to(MailService).inSingletonScope();
container.bind<IStudioService>("StudioService").to(StudioService).inSingletonScope();

export default container;