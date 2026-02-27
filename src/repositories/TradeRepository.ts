import { Trade } from '../interfaces/Trade';
import { IDatabaseService } from '../services/DatabaseService';

export class TradeRepository {
  constructor(private db: IDatabaseService) {}

  private trades() {
    return this.db.from<Trade>('trades');
  }

  async findPendingTrade(fromUserId: string, toUserId: string) {
    const { data, error } = await this.trades()
      .select('*')
      .eq('status', 'pending')
      .or(`(fromUserId.eq.${fromUserId},toUserId.eq.${toUserId}),(fromUserId.eq.${toUserId},toUserId.eq.${fromUserId})`)
      .order('createdAt', { ascending: false })
      .limit(1);
    if (error) throw error;
    return data && data.length ? data[0] : null;
  }

  async createTrade(trade: Trade) {
    // supabase handles JSON automatically when you pass objects/arrays
    const { error } = await this.trades().insert(trade);
    if (error) throw error;
  }

  async getTradeById(id: string) {
    const { data, error } = await this.trades().select('*').eq('id', id).limit(1);
    if (error) throw error;
    return data && data.length ? data[0] : null;
  }

  async getTradesByUser(userId: string) {
    const { data, error } = await this.trades()
      .select('*')
      .or(`fromUserId.eq.${userId},toUserId.eq.${userId}`)
      .order('createdAt', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async updateTradeField(tradeId: string, field: string, value: unknown, updatedAt: string) {
    const { error } = await this.trades().update({ [field]: value, updatedAt }).eq('id', tradeId);
    if (error) throw error;
  }

  async updateTradeFields(tradeId: string, fields: Record<string, unknown>) {
    if (Object.keys(fields).length === 0) return;
    const payload: Record<string, unknown> = { ...fields };
    const { error } = await this.trades().update(payload).eq('id', tradeId);
    if (error) throw error;
  }
}

