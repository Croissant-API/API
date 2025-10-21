import crypto from 'crypto';
import removeDiacritics from 'diacritics';
import { InventoryItem } from 'interfaces/Inventory';
import { Item } from 'interfaces/Item';
import { inject, injectable } from 'inversify';
import { PublicUser, PublicUserAsAdmin, User, UserExtensions } from '../interfaces/User';
import { UserRepository } from '../repositories/UserRepository';
import { decryptUserId, genKey } from '../utils/GenKey';
import { verifyUserJwt } from '../utils/Jwt';
import { IDatabaseService } from './DatabaseService';

function slugify(str: string): string {
  str = str.normalize('NFKD');
  str = removeDiacritics.remove(str);
  const substitutions: Record<string, string> = { α: 'a', β: 'b', γ: 'g', δ: 'd', ε: 'e', θ: 'o', λ: 'l', μ: 'm', ν: 'v', π: 'p', ρ: 'r', σ: 's', τ: 't', φ: 'f', χ: 'x', ψ: 'ps', ω: 'w', ℓ: 'l', '𝓁': 'l', '𝔩': 'l' };
  str = str
    .split('')
    .map(c => substitutions[c] ?? c)
    .join('');
  str = str.replace(/[^a-zA-Z0-9]/g, '');
  return str.toLowerCase();
}

// config({ path: path.join(__dirname, '..', '..', '.env') });

export interface IUserService {
  updateSteamFields(user_id: string, steam_id: string | null, steam_username: string | null, steam_avatar_url: string | null): Promise<void>;
  searchUsersByUsername(query: string): Promise<PublicUser[]>;
  updateUserBalance(user_id: string, balance: number): Promise<void>;
  createUser(user_id: string, username: string, email: string, password: string | null, provider?: 'discord' | 'google', providerId?: string): Promise<User>;
  createBrandUser(user_id: string, username: string): Promise<User>;
  getUser(user_id: string): Promise<User | null>;
  adminGetUser(user_id: string): Promise<User | null>;
  adminSearchUsers(query: string): Promise<PublicUser[]>;
  getAllUsers(): Promise<User[]>;
  getAllUsersWithDisabled(): Promise<User[]>;
  updateUser(user_id: string, username?: string, balance?: number): Promise<void>;
  deleteUser(user_id: string): Promise<void>;
  authenticateUser(api_key: string): Promise<User | null>;
  updateUserPassword(user_id: string, hashedPassword: string): Promise<void>;
  disableAccount(targetUserId: string, adminUserId: string): Promise<void>;
  reenableAccount(targetUserId: string, adminUserId: string): Promise<void>;
  findByEmail(email: string): Promise<User | null>;
  associateOAuth(user_id: string, provider: 'discord' | 'google', providerId: string): Promise<void>;
  getUserBySteamId(steamId: string): Promise<User | null>;
  generatePasswordResetToken(user_id: string): Promise<string>;
  updateWebauthnChallenge(user_id: string, challenge: string | null): Promise<void>;
  addWebauthnCredential(userId: string, credential: { id: string; name: string; created_at: Date }): Promise<void>;
  getUserByCredentialId(credentialId: string): Promise<User | null>;
  setAuthenticatorSecret(userId: string, secret: string | null): Promise<void>;
  getAuthenticatorSecret(userId: string): Promise<string | null>;
  getUserWithCompleteProfile(user_id: string): Promise<(User & UserExtensions) | null>;
  getUserWithPublicProfile(user_id: string): Promise<(PublicUser & UserExtensions) | null>;
  adminGetUserWithProfile(user_id: string): Promise<(PublicUserAsAdmin & UserExtensions) | null>;
  findByResetToken(reset_token: string): Promise<User | null>;
  getSteamAuthUrl(): string;
}

@injectable()
export class UserService implements IUserService {
  private apiKeyUserCache: Map<string, User> = new Map();

  private userRepository: UserRepository;
  constructor(@inject('DatabaseService') private databaseService: IDatabaseService) {
    this.userRepository = new UserRepository(this.databaseService);
    this.getAllUsersWithDisabled().then(users => {
      for (const user of users) {
        const key = genKey(user.user_id);
        this.apiKeyUserCache.set(key, user);
      }
    });
  }

  

  async updateSteamFields(user_id: string, steam_id: string | null, steam_username: string | null, steam_avatar_url: string | null): Promise<void> {
    await this.userRepository.updateSteamFields(user_id, steam_id, steam_username, steam_avatar_url);
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findByEmail(email);
  }

  async associateOAuth(user_id: string, provider: 'discord' | 'google', providerId: string): Promise<void> {
    await this.userRepository.associateOAuth(user_id, provider, providerId);
  }

  async disableAccount(targetUserId: string, adminUserId: string): Promise<void> {
    const admin = await this.adminGetUser(adminUserId);
    if (!admin || !admin.admin) {
      throw new Error('Unauthorized: not admin');
    }
    await this.userRepository.disableAccount(targetUserId);
  }

  async reenableAccount(targetUserId: string, adminUserId: string): Promise<void> {
    const admin = await this.adminGetUser(adminUserId);
    if (!admin || !admin.admin) {
      throw new Error('Unauthorized: not admin');
    }
    await this.userRepository.reenableAccount(targetUserId);
  }

  async searchUsersByUsername(query: string): Promise<PublicUser[]> {
    const users = await this.adminSearchUsers(query);
    
    return users
      .filter((u: PublicUser) => !u.disabled)
      .map((u: PublicUser) => ({
        user_id: u.user_id,
        username: u.username,
        verified: !!u.verified,
        isStudio: !!u.isStudio,
        admin: !!u.admin,
        beta_user: !!u.beta_user,
        badges: u.beta_user ? ['early_user', ...u.badges] : u.badges || [],
        disabled: !!u.disabled, 
      }));
  }

  async createUser(user_id: string, username: string, email: string, password: string | null, provider?: 'discord' | 'google', providerId?: string): Promise<User> {
    const existing = await this.findByEmail(email);
    if (existing) {
      if (provider && providerId) {
        await this.associateOAuth(existing.user_id, provider, providerId);
      }
      return existing;
    }
    await this.userRepository.createUser(user_id, username, email, password, provider, providerId);
    return (await this.getUser(user_id)) as User;
  }

  async createBrandUser(user_id: string, username: string): Promise<User> {
    await this.userRepository.createBrandUser(user_id, username);
    return (await this.getUser(user_id)) as User;
  }

  async getUser(user_id: string): Promise<User | null> {
    return this.userRepository.getUserByAnyId(user_id, false);
  }

  async adminGetUser(user_id: string): Promise<User | null> {
    return this.userRepository.getUserByAnyId(user_id, true);
  }

  async adminSearchUsers(query: string): Promise<PublicUser[]> {
    const users = await this.userRepository.searchUsers();
    const querySlug = slugify(query);
    const matchedUsers = users.filter((u: User) => {
      return slugify(u.username).indexOf(querySlug) !== -1;
    });
    return matchedUsers.map((u: User) => ({
      user_id: u.user_id,
      username: u.username,
      verified: !!u.verified,
      isStudio: !!u.isStudio,
      admin: !!u.admin,
      beta_user: !!u.beta_user,
      badges: u.beta_user ? ['early_user', ...u.badges] : u.badges || [],
      disabled: !!u.disabled,
    }));
  }

  async getAllUsers(): Promise<User[]> {
    return this.userRepository.getAllUsers(false);
  }

  async getAllUsersWithDisabled(): Promise<User[]> {
    return this.userRepository.getAllUsers(true);
  }

  async updateUser(user_id: string, username?: string, balance?: number): Promise<void> {
    await this.userRepository.updateUserFields(user_id, { username, balance });
  }

  async updateUserBalance(user_id: string, balance: number): Promise<void> {
    await this.userRepository.updateUserFields(user_id, { balance });
  }

  async updateUserPassword(user_id: string, hashedPassword: string): Promise<void> {
    await this.userRepository.updateUserPassword(user_id, hashedPassword);
  }

  async getUserBySteamId(steamId: string): Promise<User | null> {
    return await this.userRepository.getUserBySteamId(steamId);
  }

  async generatePasswordResetToken(email: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    await this.userRepository.generatePasswordResetToken(email, token);
    return token;
  }

  async deleteUser(user_id: string): Promise<void> {
    await this.userRepository.deleteUser(user_id);
  }

  async authenticateUser(tokenOrApiKey: string): Promise<User | null> {
    const jwtPayload = verifyUserJwt(tokenOrApiKey);
    if (jwtPayload && jwtPayload.apiKey) {
      return this.getUser(jwtPayload.user_id);
    }
    const apiKey = tokenOrApiKey;

    
    const userId = decryptUserId(apiKey);
    if (!userId) return null;

    return this.getUser(userId);
  }

  async updateWebauthnChallenge(user_id: string, challenge: string | null): Promise<void> {
    await this.userRepository.updateWebauthnChallenge(user_id, challenge);
  }

  async addWebauthnCredential(userId: string, credential: { id: string; name: string; created_at: Date }): Promise<void> {
    const existing = await this.getUser(userId);
    if (!existing) {
      throw new Error('User not found');
    }
    const credentials = JSON.parse(existing.webauthn_credentials || '[]');
    credentials.push({
      id: credential.id,
      name: credential.name,
      created_at: credential.created_at,
    });
    await this.userRepository.addWebauthnCredential(userId, JSON.stringify(credentials));
  }

  async getUserByCredentialId(credentialId: string): Promise<User | null> {
    return await this.userRepository.getUserByCredentialId(credentialId);
  }

  async setAuthenticatorSecret(userId: string, secret: string | null): Promise<void> {
    await this.userRepository.setAuthenticatorSecret(userId, secret);
  }

  async getAuthenticatorSecret(userId: string): Promise<string | null> {
    const user = await this.getUser(userId);
    return user ? user.authenticator_secret || null : null;
  }

  async getUserWithCompleteProfile(user_id: string): Promise<(User & UserExtensions) | null> {
    const query = `
      SELECT 
        u.*,
        COALESCE(json_group_array(
          CASE WHEN inv.item_id IS NOT NULL AND i.itemId IS NOT NULL THEN
            json_object(
              'user_id', inv.user_id,
              'item_id', inv.item_id,
              'itemId', i.itemId,
              'name', i.name,
              'description', i.description,
              'amount', inv.amount,
              'iconHash', i.iconHash,
              'sellable', CASE WHEN inv.sellable = 1 THEN 1 ELSE 0 END,
              'purchasePrice', inv.purchasePrice,
              'rarity', inv.rarity,
              'custom_url_link', inv.custom_url_link,
              'metadata', inv.metadata
            )
          END
        ), '[]') as inventory,
        (SELECT COALESCE(json_group_array(
          json_object(
            'itemId', oi.itemId,
            'name', oi.name,
            'description', oi.description,
            'owner', oi.owner,
            'price', oi.price,
            'iconHash', oi.iconHash,
            'showInStore', oi.showInStore
          )
        ), '[]') FROM items oi WHERE oi.owner = u.user_id AND (oi.deleted IS NULL OR oi.deleted = 0) AND oi.showInStore = 1 ORDER BY oi.name) as ownedItems,
        (SELECT COALESCE(json_group_array(
          json_object(
            'gameId', g.gameId,
            'name', g.name,
            'description', g.description,
            'price', g.price,
            'owner_id', g.owner_id,
            'showInStore', g.showInStore,
            'iconHash', g.iconHash,
            'splashHash', g.splashHash,
            'bannerHash', g.bannerHash,
            'genre', g.genre,
            'release_date', g.release_date,
            'developer', g.developer,
            'publisher', g.publisher,
            'platforms', g.platforms,
            'rating', g.rating,
            'website', g.website,
            'trailer_link', g.trailer_link,
            'multiplayer', g.multiplayer,
            'download_link', g.download_link
          )
        ), '[]') FROM games g WHERE g.owner_id = u.user_id AND g.showInStore = 1 ORDER BY g.name) as createdGames
      FROM users u
      LEFT JOIN inventories inv ON u.user_id = inv.user_id AND inv.amount > 0
      LEFT JOIN items i ON inv.item_id = i.itemId AND (i.deleted IS NULL OR i.deleted = 0)
      WHERE (u.user_id = ? OR u.discord_id = ? OR u.google_id = ? OR u.steam_id = ?)
      GROUP BY u.user_id
    `;

    await this.databaseService.request(
      `DELETE FROM inventories 
       WHERE user_id = (
         SELECT user_id FROM users 
         WHERE user_id = ?
           OR discord_id = ?
           OR google_id = ?
           OR steam_id = ?
       ) 
       AND item_id NOT IN (
         SELECT itemId FROM items WHERE deleted IS NULL OR deleted = 0
       )`,
      [user_id, user_id, user_id, user_id]
    );

    const results = await this.databaseService.read<User & UserExtensions>(query, [user_id, user_id, user_id, user_id]);
    if (results.length === 0) return null;

    const user = results[0];
    if (user.beta_user) {
      user.badges = ['early_user', ...user.badges];
    }
    if (user.inventory) {
      user.inventory = user.inventory
        .filter((item: InventoryItem) => item !== null)
        .map((item: InventoryItem) => ({
          ...item,
          metadata:
            typeof item.metadata === 'string' && item.metadata
              ? (() => {
                  try {
                    return JSON.parse(item.metadata);
                  } catch {
                    return item.metadata;
                  }
                })()
              : item.metadata,
        }));
    }
    if (user.ownedItems) {
      user.ownedItems = user.ownedItems.sort((a: Item, b: Item) => {
        const nameCompare = a.name?.localeCompare(b.name || '') || 0;
        if (nameCompare !== 0) return nameCompare;
        return 0;
      });
    }
    if (user.badges) {
      const badgeOrder = ['early_user', 'staff', 'bug_hunter', 'contributor', 'moderator', 'community_manager', 'partner'];
      user.badges = user.badges.filter(badge => badgeOrder.includes(badge));
      user.badges.sort((a, b) => badgeOrder.indexOf(a) - badgeOrder.indexOf(b));
    }
    return user;
  }

  async getUserWithPublicProfile(user_id: string): Promise<(PublicUser & UserExtensions) | null> {
    const user = await this.getUserWithCompleteProfile(user_id);
    if (!user) return null;
    
    const publicProfile: PublicUser & UserExtensions = {
      user_id: user.user_id,
      username: user.username,
      verified: user.verified,
      isStudio: user.isStudio,
      admin: user.admin,
      beta_user: user.beta_user,
      badges: user.badges,
      inventory: user.inventory || [],
      ownedItems: user.ownedItems || [],
      createdGames: user.createdGames || [],
      disabled: user.disabled,
    };
    return publicProfile;
  }

  async adminGetUserWithProfile(user_id: string): Promise<(PublicUserAsAdmin & UserExtensions) | null> {
    const user = await this.getUserWithCompleteProfile(user_id);
    if (!user) return null;

    const publicProfile: PublicUserAsAdmin & UserExtensions = {
      user_id: user.user_id,
      username: user.username,
      verified: user.verified,
      isStudio: user.isStudio,
      admin: user.admin,
      beta_user: user.beta_user,
      badges: user.badges,
      disabled: user.disabled,
      inventory: user.inventory,
      ownedItems: user.ownedItems,
      createdGames: user.createdGames,
    };
    return publicProfile;
  }

  async findByResetToken(reset_token: string): Promise<User | null> {
    return await this.userRepository.findByResetToken(reset_token);
  }

  getSteamAuthUrl(): string {
    const returnUrl = `${process.env.BASE_URL}/api/users/steam-associate`;
    return `https://steamcommunity.com/openid/login?openid.ns=http://specs.openid.net/auth/2.0&openid.mode=checkid_setup&openid.return_to=${encodeURIComponent(returnUrl)}&openid.realm=${encodeURIComponent(process.env.BASE_URL || '')}&openid.identity=http://specs.openid.net/auth/2.0/identifier_select&openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select`;
  }
}


