import { IDatabaseService } from "../services/DatabaseService";
export declare class StudioRepository {
    private databaseService;
    constructor(databaseService: IDatabaseService);
    getStudio(user_id: string): Promise<{
        user_id: string;
        admin_id: string;
        users: string[];
    } | null>;
    setStudioProperties(user_id: string, admin_id: string, userIds: string[]): Promise<void>;
    getUserStudios(user_id: string): Promise<Array<{
        user_id: string;
        admin_id: string;
        users: string[];
    }>>;
    createStudio(user_id: string, admin_id: string): Promise<void>;
}
