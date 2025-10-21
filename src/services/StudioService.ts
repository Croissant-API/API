import crypto from 'crypto';
import { inject, injectable } from 'inversify';
import { Studio, StudioUser, StudioWithApiKey } from '../interfaces/Studio';
import { User } from '../interfaces/User';
import { StudioRepository } from '../repositories/StudioRepository';
import { genKey } from '../utils/GenKey';
import { IDatabaseService } from './DatabaseService';
import { IUserService } from './UserService';

export interface IStudioService {
  getStudio(user_id: string): Promise<Studio | null>;
  setStudioProperties(user_id: string, admin_id: string, users: User[]): Promise<void>;
  getUserStudios(user_id: string): Promise<StudioWithApiKey[]>;
  createStudio(studioName: string, admin_id: string): Promise<void>;
  addUserToStudio(studioId: string, user: User): Promise<void>;
  removeUserFromStudio(studioId: string, userId: string): Promise<void>;
  getUser(user_id: string): Promise<User | null>;
}

@injectable()
export class StudioService implements IStudioService {
  private studioRepository: StudioRepository;
  constructor(
    @inject('DatabaseService') private db: IDatabaseService,
    @inject('UserService') private userService: IUserService
  ) {
    this.studioRepository = new StudioRepository(this.db);
  }

  async getStudio(user_id: string) {
    const studio = await this.studioRepository.getStudio(user_id);
    if (!studio) return null;
    const users = await this.getUsersByIds(studio.admin_id, studio.users);
    const me = (await this.userService.getUserWithPublicProfile(studio.user_id)) as User;
    if (me && me.badges) {
      if (typeof me.badges === 'string') {
        try {
          me.badges = JSON.parse(me.badges);
        } catch {
          me.badges = [];
        }
      }
      me.badges = me.badges.filter((b: string) => !!b);
    }
    return { ...studio, users, me };
  }

  async setStudioProperties(user_id: string, admin_id: string, users: User[]) {
    await this.studioRepository.setStudioProperties(
      user_id,
      admin_id,
      users.map(u => u.user_id)
    );
  }

  async getUserStudios(user_id: string) {
    const studios = await this.studioRepository.getUserStudios(user_id);
    return Promise.all(
      studios.map(async s => {
        const userIds = [...s.users, s.admin_id];
        const users = await this.getUsersByIds(s.admin_id ,userIds);
        const me = (await this.userService.getUser(s.user_id)) as StudioUser;
        return {
          user_id: s.user_id,
          admin_id: s.admin_id,
          users,
          me,
          isAdmin: s.admin_id === user_id,
          apiKey: s.admin_id === user_id ? genKey(s.user_id) : undefined,
        };
      })
    );
  }

  async createStudio(studioName: string, admin_id: string) {
    const user_id = crypto.randomUUID();
    await this.userService.createBrandUser(user_id, studioName);
    await this.studioRepository.createStudio(user_id, admin_id);
  }

  async addUserToStudio(studioId: string, user: User) {
    const studio = await this.getStudio(studioId);
    if (!studio) throw new Error('Studio not found');
    if (!studio.users.some(u => u.user_id === user.user_id)) {
      await this.setStudioProperties(studioId, studio.admin_id, [...studio.users, user]);
    }
  }

  async removeUserFromStudio(studioId: string, userId: string) {
    const studio = await this.getStudio(studioId);
    if (!studio) throw new Error('Studio not found');
    await this.setStudioProperties(
      studioId,
      studio.admin_id,
      studio.users.filter(u => u.user_id !== userId)
    );
  }

  async getUser(user_id: string) {
    return this.userService.getUser(user_id);
  }

  private async getUsersByIds(admin_id: string, userIds: string[]) {
    // if (!Array.isArray(userIds) || !userIds.length) return [];
    if (!Array.isArray(userIds))
      userIds = JSON.parse(userIds);
    userIds = [...admin_id, ...userIds];
    return this.db.read<User>(
      `SELECT user_id, username, verified, admin FROM users WHERE user_id IN (${userIds.map(() => '?').join(',')})`,
      userIds
    );
  }
}
