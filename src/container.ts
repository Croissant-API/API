import { Container } from "inversify";

import { BadgeService, IBadgeService } from "./services/BadgeService";
import { BuyOrderService, IBuyOrderService } from "./services/BuyOrderService";
import { DatabaseService, IDatabaseService } from "./services/DatabaseService";
import { GameGiftService, IGameGiftService } from "./services/GameGiftService";
import { GameService, IGameService } from "./services/GameService";
import { GameViewService, IGameViewService } from "./services/GameViewService";
import { IInventoryService, InventoryService } from "./services/InventoryService";
import { IItemService, ItemService } from "./services/ItemService";
import { ILobbyService, LobbyService } from "./services/LobbyService";
import { ILogService, LogService } from "./services/LogService";
import { IMailService, MailService } from "./services/MailService";
import { IMarketListingService, MarketListingService } from "./services/MarketListingService";
import { IOAuth2Service, OAuth2Service } from "./services/OAuth2Service";
import { ISteamOAuthService, SteamOAuthService } from "./services/SteamOAuthService";
import { IStudioService, StudioService } from "./services/StudioService";
import { ITradeService, TradeService } from "./services/TradeService";
import { IUserService, UserService } from "./services/UserService";

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
container.bind<IMarketListingService>("MarketListingService").to(MarketListingService).inSingletonScope();
container.bind<IBuyOrderService>("BuyOrderService").to(BuyOrderService).inSingletonScope();
container.bind<IBadgeService>("BadgeService").to(BadgeService).inSingletonScope();
container.bind<IGameViewService>("GameViewService").to(GameViewService).inSingletonScope();

export default container;