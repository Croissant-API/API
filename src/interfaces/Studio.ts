import { User } from "./User";

export interface Studio {
    user_id: string; // UUID principal
    admin_id: string; // UUID de l'administrateur principal
    users: User[]; // Liste des utilisateurs associés
}