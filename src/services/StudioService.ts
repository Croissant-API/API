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
  changeRole(
    user_id: string,
    role: string
  ): Promise<{ success: boolean; error?: string }>;
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
    // On suppose que la table studios a une colonne users (string[] sérialisé JSON)
    const studios = await this.databaseService.read<any[]>(
      "SELECT * FROM studios WHERE user_id = ?",
      [user_id]
    );
    if (studios.length === 0) return null;
    const studio = studios[0];
    // Désérialise la colonne users (JSON.stringify([id1, id2, ...]))
    let userIds: string[] = [];
    try {
      userIds = JSON.parse(studio.users);
    } catch {
      userIds = [];
    }
    let users: User[] = [];
    if (userIds.length > 0) {
      users = await this.databaseService.read<User[]>(
        `SELECT * FROM users WHERE user_id IN (${userIds.map(() => "?").join(",")})`,
        userIds
      );
    }
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
    // Studios où l'utilisateur est membre (user_id dans la colonne users)
    const studios = await this.databaseService.read<any[]>(
      `SELECT * FROM studios`,
      []
    );
    const result: Array<Studio & { isAdmin: boolean }> = [];
    for (const studio of studios) {
      let userIds: string[] = [];
      try {
        userIds = JSON.parse(studio.users);
      } catch {
        userIds = [];
      }

      userIds.push(studio.admin_id);
      const studioUser = await this.userService.getUser(studio.user_id);

      if (userIds.includes(user_id)) {
        let users: User[] = [];
        if (userIds.length > 0) {
          users = await this.databaseService.read<User[]>(
            `SELECT user_id as userId, username, verified, admin FROM users WHERE user_id IN (${userIds.map(() => "?").join(",")})`,
            userIds
          );
        }
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

  async changeRole(
    user_id: string,
    role: string
  ): Promise<{ success: boolean; error?: string }> {
    if (user_id === role) {
      await this.databaseService.update(
        "UPDATE users SET role = ? WHERE user_id = ?",
        [role, user_id]
      );
      return { success: true };
    }

    const studios = await this.getUserStudios(user_id);
    if (studios.length === 0)
      return { success: false, error: "User doesn't have any studios" };

    const studio = await this.userService.getUser(role);
    if (!studio) return { success: false, error: "User not found" };
    if (!studio.isStudio) {
      return { success: false, error: "User is not a studio" };
    }

    for (const studio of studios) {
      if (studio.user_id !== role) continue;
      if (studio.users.some((u: any) => u.userId === user_id)) {
        await this.databaseService.update(
          "UPDATE users SET role = ? WHERE user_id = ?",
          [role, user_id]
        );
        return { success: true };
      }
    }
    return { success: false, error: "User is not in this studio" };
  }

  /**
   * Ajoute un utilisateur à un studio
   * @param studioId L'identifiant du studio (user_id du studio)
   * @param user L'utilisateur à ajouter
   */
  async addUserToStudio(studioId: string, user: User): Promise<void> {
    // Récupère le studio
    const studio = await this.getStudio(studioId);
    if (!studio) throw new Error("Studio not found");
    // Récupère la liste des user_ids
    const userIds = studio.users.map((u) => u.user_id);
    if (!userIds.includes(user.user_id)) {
      userIds.push(user.user_id);
      await this.setStudioProperties(studioId, studio.admin_id, [
        ...studio.users,
        user,
      ]);
    }
  }

  /**
   * Retire un utilisateur d'un studio
   * @param studioId L'identifiant du studio (user_id du studio)
   * @param userId L'identifiant de l'utilisateur à retirer
   */
  async removeUserFromStudio(studioId: string, userId: string): Promise<void> {
    // Récupère le studio
    const studio = await this.getStudio(studioId);
    if (!studio) throw new Error("Studio not found");
    // Filtre la liste des users
    const newUsers = studio.users.filter((u) => u.user_id !== userId);
    await this.setStudioProperties(studioId, studio.admin_id, newUsers);
  }

  async getUser(user_id: string): Promise<User | null> {
    return await this.userService.getUser(user_id);
  }
}
