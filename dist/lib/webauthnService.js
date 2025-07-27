"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAuthentication = exports.getAuthenticationOptions = exports.verifyRegistration = exports.getRegistrationOptions = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any */
const server_1 = require("@simplewebauthn/server");
function getRegistrationOptions(user) {
    console.log('Generating registration options for user:', user);
    return (0, server_1.generateRegistrationOptions)({
        rpName: 'Croissant',
        rpID: 'localhost',
        userID: user.id,
        userName: user.username,
        attestationType: 'none',
        authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    });
}
exports.getRegistrationOptions = getRegistrationOptions;
async function verifyRegistration(body, expectedChallenge) {
    return (0, server_1.verifyRegistrationResponse)({
        response: body.credential,
        expectedChallenge,
        expectedOrigin: 'http://localhost:8580',
        expectedRPID: 'localhost',
    });
}
exports.verifyRegistration = verifyRegistration;
function getAuthenticationOptions(credentials) {
    return (0, server_1.generateAuthenticationOptions)({
        rpID: 'localhost',
        userVerification: 'preferred',
        allowCredentials: credentials.map((c) => ({
            id: c.credentialID,
            type: 'public-key',
            transports: c.transports,
        })),
    });
}
exports.getAuthenticationOptions = getAuthenticationOptions;
async function verifyAuthentication(body, expectedChallenge, credentials) {
    const authenticator = credentials.find((c) => c.credentialID === body.credential.rawId);
    if (!authenticator) {
        throw new Error('Authenticator not found');
    }
    return (0, server_1.verifyAuthenticationResponse)({
        response: body.credential,
        expectedChallenge,
        expectedOrigin: 'http://localhost:8580',
        expectedRPID: 'localhost',
        credential: {
            id: authenticator.credentialID,
            publicKey: authenticator.credentialPublicKey,
            counter: authenticator.counter,
            transports: authenticator.transports,
        },
    });
}
exports.verifyAuthentication = verifyAuthentication;
// Add DB logic for storing/retrieving credentials as needed
