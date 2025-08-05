import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { Studio, StudioUser, StudioWithApiKey } from "../interfaces/Studio";
import { User } from "../interfaces/User";
import { IUserService } from "./UserService";
import crypto from "crypto";
import { genKey } from "../utils/GenKey";

export interface IStudioService {
  getStudio(user_id: string): Promise<Studio | null>;
  setStudioProperties(
    user_id: string,
    admin_id: string,
    users: User[]
  ): Promise<void>;
  getUserStudios(user_id: string): Promise<StudioWithApiKey[]>;
  createStudio(studioName: string, admin_id: string): Promise<void>;
  addUserToStudio(studioId: string, user: User): Promise<void>;
  removeUserFromStudio(studioId: string, userId: string): Promise<void>;
  getUser(user_id: string): Promise<User | null>;
}

@injectable()
export class StudioService implements IStudioService {
  private readonly studiosTable = 'studios';
  private readonly usersTable = 'users';

  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService,
    @inject("UserService") private userService: IUserService
  ) {}

  async getStudio(user_id: string): Promise<Studio | null> {
    const knex = this.databaseService.getKnex();

    try {
      const studioResponse = await knex(this.studiosTable)
        .select('user_id', 'admin_id', 'users')
        .where({ user_id: user_id })
        .first();

      if (!studioResponse) return null;

      const users: string[] = JSON.parse(studioResponse.users);
      const usersData = await this.getUsersByIds(users);
      const me = (await this.userService.getUserWithPublicProfile(
        studioResponse.user_id
      )) as StudioUser;

      return { ...studioResponse, users: usersData, me };
    } catch (error) {
      console.error("Error getting studio:", error);
      throw error;
    }
  }

  async setStudioProperties(
    user_id: string,
    admin_id: string,
    users: User[]
  ): Promise<void> {
    const knex = this.databaseService.getKnex();
    const userIds = users.map((u) => u.user_id);

    try {
      await knex(this.studiosTable)
        .where({ user_id: user_id })
        .update({
          admin_id: admin_id,
          users: JSON.stringify(userIds),
        });
    } catch (error) {
      console.error("Error setting studio properties:", error);
      throw error;
    }
  }

  async getUserStudios(user_id: string): Promise<StudioWithApiKey[]> {
    const knex = this.databaseService.getKnex();

    try {
      const studiosResponse = await knex(this.studiosTable)
        .select('user_id', 'admin_id', 'users')
        .where({ admin_id: user_id })
        .orWhereRaw('users LIKE ?', [`%"${user_id}"%`]);

      const studios = await Promise.all(
        studiosResponse.map(async (studioResponse) => {
          const userIds = [
            ...JSON.parse(studioResponse.users),
            studioResponse.admin_id,
          ];
          const users = await this.getUsersByIds(userIds);
          const me = (await this.userService.getUser(
            studioResponse.user_id
          )) as StudioUser;

          return {
            user_id: studioResponse.user_id,
            admin_id: studioResponse.admin_id,
            users,
            me,
            apiKey:
              studioResponse.admin_id === user_id
                ? genKey(studioResponse.user_id)
                : undefined,
          };
        })
      );

      return studios;
    } catch (error) {
      console.error("Error getting user studios:", error);
      throw error;
    }
  }

  async createStudio(studioName: string, admin_id: string): Promise<void> {
    const knex = this.databaseService.getKnex();
    const user_id = crypto.randomUUID();

    try {
      await this.userService.createBrandUser(user_id, studioName);
      await knex(this.studiosTable).insert({
        user_id: user_id,
        admin_id: admin_id,
        users: JSON.stringify([]),
      });
    } catch (error) {
      console.error("Error creating studio:", error);
      throw error;
    }
  }

  async addUserToStudio(studioId: string, user: User): Promise<void> {
    const studio = await this.getStudio(studioId);
    if (!studio) throw new Error("Studio not found");

    const userIds = studio.users.map((u) => u.user_id);
    if (!userIds.includes(user.user_id)) {
      await this.setStudioProperties(studioId, studio.admin_id, [
        ...studio.users,
        user,
      ]);
    }
  }

  async removeUserFromStudio(studioId: string, userId: string): Promise<void> {
    const studio = await this.getStudio(studioId);
    if (!studio) throw new Error("Studio not found");

    await this.setStudioProperties(
      studioId,
      studio.admin_id,
      studio.users.filter((u) => u.user_id !== userId)
    );
  }

  async getUser(user_id: string): Promise<User | null> {
    return await this.userService.getUser(user_id);
  }

  private async getUsersByIds(userIds: string[]): Promise<User[]> {
    const knex = this.databaseService.getKnex();

    try {
      if (userIds.length === 0) return [];

      return await knex(this.usersTable)
        .select('user_id', 'username', 'verified', 'admin')
        .whereIn('user_id', userIds);
    } catch (error) {
      console.error("Error getting users by ids:", error);
      throw error;
    }
  }
}
