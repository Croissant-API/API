import { User } from "./User";
export interface Studio {
    user_id: string;
    admin_id: string;
    users: User[];
}
