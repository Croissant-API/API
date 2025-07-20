export interface User {
    id: number;
    user_id: string;
    balance: number;
    username: string;
    email?: string;
    password?: string;
    disabled?: boolean;
    admin?: boolean;
}
