import { User } from './User';
export interface Studio {
    user_id: string;
    admin_id: string;
    users: User[];
    me: StudioUser;
}
export interface StudioUser {
    user_id: string;
    username: string;
    verified: boolean;
}
export interface StudioWithApiKey extends Studio {
    apiKey?: string;
}
