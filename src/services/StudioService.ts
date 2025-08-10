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
  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService,
    @inject("UserService") private userService: IUserService
  ) {}

  async getStudio(user_id: string): Promise<Studio | null> {
    const studiosResponse = await this.databaseService.read<{user_id: string, admin_id: string, users: string[]}>("SELECT * FROM studios WHERE user_id = ?", [user_id]);

    if (studiosResponse.length === 0) return null;

    const studioResponse = studiosResponse[0];

    const users = await this.getUsersByIds(studioResponse.users);
    const me = (await this.userService.getUserWithPublicProfile(
      studioResponse.user_id
    )) as StudioUser;

    return { ...studioResponse, users, me };
  }

  async setStudioProperties(
    user_id: string,
    admin_id: string,
    users: User[]
  ): Promise<void> {
    const userIds = users.map((u) => u.user_id);
    await this.databaseService.request(
      "UPDATE studios SET admin_id = ?, users = ? WHERE user_id = ?",
      [admin_id, JSON.stringify(userIds), user_id]
    );
  }

  async getUserStudios(user_id: string): Promise<StudioWithApiKey[]> {
    const studiosResponse = await this.databaseService.read<{
      user_id: string;
      admin_id: string;
      users: string;
    }>(`SELECT * FROM studios WHERE admin_id = ? OR users LIKE ?`, [
      user_id,
      `%"${user_id}"%`,
    ]);

    const studios = await Promise.all(
      studiosResponse.map(async (studioResponse) => {
        const userIds = [
          ...studioResponse.users,
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
  }

  async createStudio(studioName: string, admin_id: string): Promise<void> {
    const user_id = crypto.randomUUID();

    await this.userService.createBrandUser(user_id, studioName);
    await this.databaseService.request(
      "INSERT INTO studios (user_id, admin_id, users) VALUES (?, ?, ?)",
      [user_id, admin_id, JSON.stringify([])]
    );
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
    if (userIds.length === 0) return [];

    return await this.databaseService.read<User>(
      `SELECT user_id, username, verified, admin FROM users WHERE user_id IN (${userIds.map(() => "?").join(
        ","
      )})`,
      userIds
    );
  }
}
