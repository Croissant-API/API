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
  getFormattedStudio(user_id: string): Promise<{
    user_id: string;
    username: string;
    verified: boolean;
    admin_id: string;
    users: Array<{
      user_id: string;
      username: string;
      verified: boolean;
      admin: boolean;
    }>;
  } | null>;
  setStudioProperties(
    user_id: string,
    admin_id: string,
    users: User[]
  ): Promise<void>;
  getUserStudios(
    user_id: string
  ): Promise<Array<Studio & { isAdmin: boolean }>>;
  getFormattedUserStudios(
    user_id: string
  ): Promise<Array<{
    user_id: string;
    username: string;
    verified: boolean;
    admin_id: string;
    isAdmin: boolean;
    apiKey?: string;
    users: Array<{
      user_id: string;
      username: string;
      verified: boolean;
      admin: boolean;
    }>;
  }>>;
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
      `SELECT user_id, username, verified, admin FROM users WHERE user_id IN (${userIds.map(() => "?").join(",")})`,
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

  async getFormattedStudio(user_id: string): Promise<{
    user_id: string;
    username: string;
    verified: boolean;
    admin_id: string;
    users: Array<{
      user_id: string;
      username: string;
      verified: boolean;
      admin: boolean;
    }>;
  } | null> {
    const studioInfo = await this.databaseService.read<Array<{
      studio_user_id: string;
      username: string;
      verified: boolean;
      admin_id: string;
      users: string;
    }>>(
      `SELECT s.user_id as studio_user_id, u.username, u.verified, s.admin_id, s.users
       FROM studios s
       INNER JOIN users u ON s.user_id = u.user_id
       WHERE s.user_id = ?`,
      [user_id]
    );

    if (!studioInfo.length) return null;

    const studio = studioInfo[0];
    const userIds = this.parseUserIds(studio.users);
    
    if (!userIds.length) {
      return {
        user_id: studio.studio_user_id,
        username: studio.username,
        verified: studio.verified,
        admin_id: studio.admin_id,
        users: []
      };
    }

    const users = await this.databaseService.read<Array<{
      user_id: string;
      username: string;
      verified: boolean;
      admin: boolean;
    }>>(
      `SELECT user_id, username, verified, admin 
       FROM users 
       WHERE user_id IN (${userIds.map(() => "?").join(",")})`,
      userIds
    );

    return {
      user_id: studio.studio_user_id,
      username: studio.username,
      verified: studio.verified,
      admin_id: studio.admin_id,
      users
    };
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
          isAdmin: studio.admin_id === user_id,
          apiKey: studio.admin_id == user_id ? genKey(studio.user_id) : null,
        });
      }
    }
    return result;
  }

  async getFormattedUserStudios(
    user_id: string
  ): Promise<Array<{
    user_id: string;
    username: string;
    verified: boolean;
    admin_id: string;
    isAdmin: boolean;
    apiKey?: string;
    users: Array<{
      user_id: string;
      username: string;
      verified: boolean;
      admin: boolean;
    }>;
  }>> {
    // Récupère tous les studios où l'utilisateur est membre ou admin
    const studiosInfo = await this.databaseService.read<Array<{
      studio_user_id: string;
      username: string;
      verified: boolean;
      admin_id: string;
      users: string;
    }>>(
      `SELECT s.user_id as studio_user_id, u.username, u.verified, s.admin_id, s.users
       FROM studios s
       INNER JOIN users u ON s.user_id = u.user_id
       WHERE s.admin_id = ? OR JSON_EXTRACT(s.users, '$') LIKE ?`,
      [user_id, `%"${user_id}"%`]
    );

    const result = [];
    for (const studio of studiosInfo) {
      const userIds = this.parseUserIds(studio.users);
      const isAdmin = studio.admin_id === user_id;
      
      const users = userIds.length > 0 ? await this.databaseService.read<Array<{
        user_id: string;
        username: string;
        verified: boolean;
        admin: boolean;
      }>>(
        `SELECT user_id, username, verified, admin 
         FROM users 
         WHERE user_id IN (${userIds.map(() => "?").join(",")})`,
        userIds
      ) : [];

      result.push({
        user_id: studio.studio_user_id,
        username: studio.username,
        verified: studio.verified,
        admin_id: studio.admin_id,
        isAdmin,
        apiKey: isAdmin ? genKey(studio.studio_user_id) : undefined,
        users
      });
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