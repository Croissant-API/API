export interface GameView {
    id: number;
    gameId: string;
    viewer_cookie: string;
    ip_address: string;
    viewed_at: string;
    user_agent?: string;
}
export interface GameViewStats {
    gameId: string;
    total_views: number;
    unique_views: number;
    views_today: number;
    views_this_week: number;
    views_this_month: number;
}
