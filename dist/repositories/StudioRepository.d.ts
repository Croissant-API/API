import { IDatabaseService } from "../services/DatabaseService";
export declare class StudioRepository {
    private db;
    constructor(db: IDatabaseService);
    private parseUsers;
    getStudio(user_id: string): Promise<{
        user_id: string;
        admin_id: string;
        users: string[];
    }>;
    setStudioProperties(user_id: string, admin_id: string, userIds: string[]): Promise<void>;
    getUserStudios(user_id: string): Promise<{
        users: string[];
        user_id: string;
        admin_id: string;
    }[]>;
    createStudio(user_id: string, admin_id: string): Promise<void>;
}

