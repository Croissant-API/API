import { inject, injectable } from "inversify";
import { Lobby } from "../interfaces/Lobbies";
import { LobbyRepository } from "../repositories/LobbyRepository";
import { IDatabaseService } from "./DatabaseService";
import { UserService } from "./UserService";

export interface ILobbyService {
  getLobby(lobbyId: string): Promise<Lobby | null>;
  joinLobby(lobbyId: string, userId: string): Promise<void>;
  leaveLobby(lobbyId: string, userId: string): Promise<void>;
  getUserLobby(userId: string): Promise<Lobby | null>;
  createLobby(lobbyId: string, users?: string[]): Promise<void>;
  deleteLobby(lobbyId: string): Promise<void>;
  getUserLobbies(userId: string): Promise<Lobby[]>;
  leaveAllLobbies(userId: string): Promise<void>;
}

@injectable()
export class LobbyService implements ILobbyService {
  private lobbyRepository: LobbyRepository;
  constructor(
    @inject("DatabaseService") private databaseService: IDatabaseService,
    @inject("UserService") private userService: UserService
  ) {
    this.lobbyRepository = new LobbyRepository(this.databaseService);
  }

  async getLobby(lobbyId: string): Promise<Lobby | null> {
    const lobby = await this.lobbyRepository.getLobby(lobbyId);
    if (!lobby) return null;
    return lobby;
  }


  async joinLobby(lobbyId: string, userId: string): Promise<void> {
    const lobby = await this.getLobby(lobbyId);
    const user = await this.userService.getUser(userId);
    if (!lobby) throw new Error("Lobby not found");
    if (!user) throw new Error("User not found");
    const users = [...new Set([...lobby.users, user])];
    await this.lobbyRepository.updateLobbyUsers(lobbyId, users);
  }

  async leaveLobby(lobbyId: string, userId: string): Promise<void> {
    const lobby = await this.getLobby(lobbyId);
    if (!lobby) throw new Error("Lobby not found");
    const newUsers = lobby.users.filter((u) => u.user_id !== userId);
    if (newUsers.length === 0) {
      // await this.deleteLobby(lobbyId);
    } else {
      await this.lobbyRepository.updateLobbyUsers(lobbyId, newUsers);
    }
  }

  async getUserLobby(userId: string): Promise<Lobby | null> {
    const lobby = await this.lobbyRepository.getUserLobby(userId);
    if (!lobby) return null;
    return lobby;
  }

  async createLobby(lobbyId: string, users: string[] = []): Promise<void> {
    await this.lobbyRepository.createLobby(lobbyId, users);
  }

  async deleteLobby(lobbyId: string): Promise<void> {
    await this.lobbyRepository.deleteLobby(lobbyId);
  }

  async getUserLobbies(userId: string): Promise<Lobby[]> {
    const lobbies = await this.lobbyRepository.getUserLobbies(userId);
    return Promise.all(
      lobbies.map(async (lobby) => {
        return lobby;
      })
    );
  }

  async leaveAllLobbies(userId: string): Promise<void> {
    const lobbies = await this.getUserLobbies(userId);
    for (const lobby of lobbies) {
      await this.leaveLobby(lobby.lobbyId, userId);
    }
  }

}
