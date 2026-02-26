"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.METADATA_KEY = exports.TYPE = void 0;
exports.TYPE = {
    HonoRequestHandler: Symbol.for('HonoRequestHandler'),
};
exports.METADATA_KEY = {
    controller: 'hono-inversify:controller',
    httpMethod: 'hono-inversify:httpMethod',
};
