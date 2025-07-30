import { Container } from "inversify";

import { IDatabaseService, DatabaseService } from "./services/DatabaseService";
import { IInventoryService, InventoryService } from "./services/InventoryService";
import { IItemService, ItemService } from "./services/ItemService";
import { IUserService, UserService } from "./services/UserService";
import { ILobbyService, LobbyService } from "./services/LobbyService";
import { ITradeService, TradeService } from "./services/TradeService";
import { IGameService, GameService } from "./services/GameService";
import { IOAuth2Service, OAuth2Service } from "./services/OAuth2Service";
import { ISteamOAuthService, SteamOAuthService } from "./services/SteamOAuthService";
import { IMailService, MailService } from "./services/MailService";
import { IStudioService, StudioService } from "./services/StudioService";
import { ILogService, LogService } from "./services/LogService";
import { IGameGiftService, GameGiftService } from "./services/GameGiftService";
import { MarketplaceService } from "./services/MarketplaceService";

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
container.bind<ILogService>("LogService").to(LogService).inSingletonScope();
container.bind<IGameGiftService>("GameGiftService").to(GameGiftService).inSingletonScope();
container.bind<MarketplaceService>("MarketplaceService").to(MarketplaceService);

export default container;