import { IDatabaseService } from "./DatabaseService";
import { Studio, StudioWithApiKey } from "../interfaces/Studio";
import { User } from "../interfaces/User";
import { IUserService } from "./UserService";
export interface IStudioService {
    getStudio(user_id: string): Promise<Studio | null>;
    setStudioProperties(user_id: string, admin_id: string, users: User[]): Promise<void>;
    getUserStudios(user_id: string): Promise<StudioWithApiKey[]>;
    createStudio(studioName: string, admin_id: string): Promise<void>;
    addUserToStudio(studioId: string, user: User): Promise<void>;
    removeUserFromStudio(studioId: string, userId: string): Promise<void>;
    getUser(user_id: string): Promise<User | null>;
}
export declare class StudioService implements IStudioService {
    private databaseService;
    private userService;
    constructor(databaseService: IDatabaseService, userService: IUserService);
    getStudio(user_id: string): Promise<Studio | null>;
    setStudioProperties(user_id: string, admin_id: string, users: User[]): Promise<void>;
    getUserStudios(user_id: string): Promise<StudioWithApiKey[]>;
    createStudio(studioName: string, admin_id: string): Promise<void>;
    addUserToStudio(studioId: string, user: User): Promise<void>;
    removeUserFromStudio(studioId: string, userId: string): Promise<void>;
    getUser(user_id: string): Promise<User | null>;
    private getUsersByIds;
}
