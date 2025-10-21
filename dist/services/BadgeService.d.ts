import { Badge, BadgeType } from '../interfaces/Badge';
import { IDatabaseService } from './DatabaseService';
export interface IBadgeService {
    getActiveBadgesForGame(gameId: string): Promise<Badge[]>;
    addBadgeToGame(gameId: string, badgeName: string): Promise<void>;
    removeExpiredBadges(): Promise<void>;
    getBadgeTypes(): Promise<BadgeType[]>;
}
export declare class BadgeService implements IBadgeService {
    private databaseService;
    private badgeRepository;
    constructor(databaseService: IDatabaseService);
    getActiveBadgesForGame(gameId: string): Promise<Badge[]>;
    addBadgeToGame(gameId: string, badgeName: string): Promise<void>;
    removeExpiredBadges(): Promise<void>;
    getBadgeTypes(): Promise<BadgeType[]>;
}
