export declare function getRegistrationOptions(user: any): Promise<import("@simplewebauthn/server").PublicKeyCredentialCreationOptionsJSON>;
export declare function verifyRegistration(body: any, expectedChallenge: string): Promise<import("@simplewebauthn/server").VerifiedRegistrationResponse>;
export declare function getAuthenticationOptions(credentials: any[]): Promise<import("@simplewebauthn/server").PublicKeyCredentialRequestOptionsJSON>;
export declare function verifyAuthentication(body: any, expectedChallenge: string, credentials: any[]): Promise<import("@simplewebauthn/server").VerifiedAuthenticationResponse>;
