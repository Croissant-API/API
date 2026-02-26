import { Studio } from 'interfaces/Studio';
import { IDatabaseService } from '../services/DatabaseService';
export declare class StudioRepository {
    private db;
    constructor(db: IDatabaseService);
    private parseUsers;
    getStudio(user_id: string): Promise<Studio | null>;
    setStudioProperties(user_id: string, admin_id: string, userIds: string[]): Promise<void>;
    getUserStudios(user_id: string): Promise<Array<{
        user_id: string;
        admin_id: string;
        users: string[];
    }>>;
    createStudio(user_id: string, admin_id: string): Promise<void>;
}
