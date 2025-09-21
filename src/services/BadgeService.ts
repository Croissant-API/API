import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { BadgeRepository } from "../repositories/BadgeRepository";
import { Badge, BadgeType } from "../interfaces/Badge";

export interface IBadgeService {
  getActiveBadgesForGame(gameId: string): Promise<Badge[]>;
  addBadgeToGame(gameId: string, badgeName: string): Promise<void>;
  removeExpiredBadges(): Promise<void>;
  getBadgeTypes(): Promise<BadgeType[]>;
}

@injectable()
export class BadgeService implements IBadgeService {
  private badgeRepository: BadgeRepository;

  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService
  ) {
    this.badgeRepository = new BadgeRepository(this.databaseService);
  }

  async getActiveBadgesForGame(gameId: string): Promise<Badge[]> {
    return this.badgeRepository.getActiveBadgesForGame(gameId);
  }

  async addBadgeToGame(gameId: string, badgeName: string): Promise<void> {
    const badgeType = await this.badgeRepository.getBadgeTypeByName(badgeName);
    if (!badgeType) {
      throw new Error(`Badge type '${badgeName}' not found`);
    }

    await this.badgeRepository.addBadgeToGame(gameId, badgeType.id, badgeType.duration_days);
  }

  async removeExpiredBadges(): Promise<void> {
    await this.badgeRepository.removeExpiredBadges();
  }

  async getBadgeTypes(): Promise<BadgeType[]> {
    return this.badgeRepository.getBadgeTypes();
  }
}


