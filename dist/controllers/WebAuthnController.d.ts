import { Context } from 'hono';
import { ILogService } from '../services/LogService';
import { IUserService } from '../services/UserService';
export declare class WebAuthns {
    private userService;
    private logService;
    constructor(userService: IUserService, logService: ILogService);
    private sendError;
    private createLog;
    getRegistrationOptions(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        rp: {
            id?: string | undefined;
            name: string;
        };
        user: {
            id: string;
            name: string;
            displayName: string;
        };
        challenge: string;
        pubKeyCredParams: {
            alg: number;
            type: "public-key";
        }[];
        timeout?: number | undefined;
        excludeCredentials?: {
            id: string;
            type: "public-key";
            transports?: import("@simplewebauthn/server/script/types").AuthenticatorTransportFuture[] | undefined;
        }[] | undefined;
        authenticatorSelection?: {
            authenticatorAttachment?: import("@simplewebauthn/server/script/types").AuthenticatorAttachment | undefined;
            requireResidentKey?: boolean | undefined;
            residentKey?: import("@simplewebauthn/server/script/types").ResidentKeyRequirement | undefined;
            userVerification?: import("@simplewebauthn/server/script/types").UserVerificationRequirement | undefined;
        } | undefined;
        hints?: import("@simplewebauthn/server/script/types").PublicKeyCredentialHint[] | undefined;
        attestation?: import("@simplewebauthn/server/script/types").AttestationConveyancePreference | undefined;
        attestationFormats?: import("@simplewebauthn/server/script/types").AttestationFormat[] | undefined;
        extensions?: {
            appid?: string | undefined;
            credProps?: boolean | undefined;
            hmacCreateSecret?: boolean | undefined;
            minPinLength?: boolean | undefined;
        } | undefined;
    }, 200, "json">)>;
    verifyRegistration(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">>;
    getAuthenticationOptionsHandler(c: Context): Promise<(Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">) | (Response & import("hono").TypedResponse<{
        challenge: string;
        timeout?: number | undefined;
        rpId?: string | undefined;
        allowCredentials?: {
            id: string;
            type: "public-key";
            transports?: import("@simplewebauthn/server/script/types").AuthenticatorTransportFuture[] | undefined;
        }[] | undefined;
        userVerification?: import("@simplewebauthn/server/script/types").UserVerificationRequirement | undefined;
        hints?: import("@simplewebauthn/server/script/types").PublicKeyCredentialHint[] | undefined;
        extensions?: {
            appid?: string | undefined;
            credProps?: boolean | undefined;
            hmacCreateSecret?: boolean | undefined;
            minPinLength?: boolean | undefined;
        } | undefined;
    }, 200, "json">)>;
    verifyAuthenticationHandler(c: Context): Promise<Response & import("hono").TypedResponse<{
        message: string;
    }, any, "json">>;
}
