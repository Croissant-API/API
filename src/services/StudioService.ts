/* eslint-disable @typescript-eslint/no-explicit-any */
import { inject, injectable } from "inversify";
import { IDatabaseService } from "./DatabaseService";
import { Studio } from "../interfaces/Studio";
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
  getUserStudios(
    user_id: string
  ): Promise<Array<Studio & { isAdmin: boolean }>>;
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

  private parseUserIds(users: string): string[] {
    try {
      return JSON.parse(users);
    } catch {
      return [];
    }
  }

  private async getStudioUsers(userIds: string[]): Promise<User[]> {
    if (!userIds.length) return [];
    return this.databaseService.read<User[]>(
      `SELECT user_id as userId, username, verified, admin FROM users WHERE user_id IN (${userIds.map(() => "?").join(",")})`,
      userIds
    );
  }

  async getStudio(user_id: string): Promise<Studio | null> {
    const studios = await this.databaseService.read<any[]>(
      "SELECT * FROM studios WHERE user_id = ?",
      [user_id]
    );
    if (studios.length === 0) return null;
    const studio = studios[0];
    const userIds = this.parseUserIds(studio.users);
    const users = await this.getStudioUsers(userIds);
    return { ...studio, users };
  }

  async setStudioProperties(
    user_id: string,
    admin_id: string,
    users: User[]
  ): Promise<void> {
    // Met à jour l'admin_id et la liste des users (stockée en JSON)
    const userIds = users.map((u) => u.user_id);
    await this.databaseService.update(
      "UPDATE studios SET admin_id = ?, users = ? WHERE user_id = ?",
      [admin_id, JSON.stringify(userIds), user_id]
    );
  }

  async getUserStudios(
    user_id: string
  ): Promise<Array<Studio & { isAdmin: boolean }>> {
    const studios = await this.databaseService.read<any[]>(`SELECT * FROM studios`, []);
    const result: Array<Studio & { isAdmin: boolean }> = [];
    for (const studio of studios) {
      const userIds = this.parseUserIds(studio.users);
      userIds.push(studio.admin_id);
      const studioUser = await this.userService.getUser(studio.user_id);
      if (userIds.includes(user_id)) {
        const users = await this.getStudioUsers(userIds);
        result.push({
          ...studio,
          username: studioUser?.username,
          verified: studioUser?.verified,
          users,
          apiKey: studio.admin_id == user_id ? genKey(studio.user_id) : null,
        });
      }
    }
    return result;
  }

  async createStudio(studioName: string, admin_id: string): Promise<void> {
    // Crée l'utilisateur admin si besoin (ou récupère l'existant)
    const user_id = crypto.randomUUID();
    await this.userService.createBrandUser(user_id, studioName);
    // Crée le studio
    await this.databaseService.create(
      "INSERT INTO studios (user_id, admin_id, users) VALUES (?, ?, ?)",
      [user_id, admin_id, JSON.stringify([])]
    );
  }

  /**
   * Ajoute un utilisateur à un studio
   * @param studioId L'identifiant du studio (user_id du studio)
   * @param user L'utilisateur à ajouter
   */
  async addUserToStudio(studioId: string, user: User): Promise<void> {
    const studio = await this.getStudio(studioId);
    if (!studio) throw new Error("Studio not found");
    const userIds = studio.users.map((u) => u.user_id);
    if (!userIds.includes(user.user_id)) {
      await this.setStudioProperties(studioId, studio.admin_id, [...studio.users, user]);
    }
  }

  /**
   * Retire un utilisateur d'un studio
   * @param studioId L'identifiant du studio (user_id du studio)
   * @param userId L'identifiant de l'utilisateur à retirer
   */
  async removeUserFromStudio(studioId: string, userId: string): Promise<void> {
    const studio = await this.getStudio(studioId);
    if (!studio) throw new Error("Studio not found");
    await this.setStudioProperties(studioId, studio.admin_id, studio.users.filter((u) => u.user_id !== userId));
  }

  async getUser(user_id: string): Promise<User | null> {
    return await this.userService.getUser(user_id);
  }
}
