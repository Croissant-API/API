export declare function generateUserJwt(user: {
    user_id: string;
    username: string;
    email: string;
}, apiKey: string): string;
export declare function verifyUserJwt(token: string): {
    user_id: string;
    username: string;
    email: string;
    apiKey: string;
} | null;

