export interface Badge {
  id: number;
  name: string;
  display_name: string;
  color: string;
  icon: string;
  expires_at: string;
}

export interface GameBadge {
  gameId: string;
  badgeId: number;
  created_at: string;
  expires_at: string;
}

export interface BadgeType {
  id: number;
  name: string;
  display_name: string;
  color: string;
  icon: string;
  duration_days: number;
}
