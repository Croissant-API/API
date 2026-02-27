import { Badge, BadgeType } from '../interfaces/Badge';
import { IDatabaseService } from '../services/DatabaseService';
export declare class BadgeRepository {
    private databaseService;
    constructor(databaseService: IDatabaseService);
    getBadgeTypes(): Promise<BadgeType[]>;
    getActiveBadgesForGame(gameId: string): Promise<Badge[]>;
    addBadgeToGame(gameId: string, badgeId: number, durationDays: number): Promise<void>;
    removeExpiredBadges(): Promise<void>;
    getBadgeTypeByName(name: string): Promise<BadgeType | null>;
}
