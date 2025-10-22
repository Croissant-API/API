"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggedCheck = void 0;
const inversify_1 = require("inversify");
const container_1 = __importDefault(require("../container"));
let LoggedCheck = class LoggedCheck {
    constructor(studioService) {
        this.studioService = studioService;
    }
};
exports.LoggedCheck = LoggedCheck;
LoggedCheck.middleware = async (req, res, next) => {
    const authHeader = req.headers['authorization'] || 'Bearer ' + req.headers['cookie']?.toString().split('token=')[1]?.split(';')[0];
    const roleCookie = req.headers['cookie']?.toString().split('role=')[1]?.split(';')[0];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).send({ message: 'Unauthorized' });
    }
    const token = authHeader.split('Bearer ')[1];
    if (!token) {
        return res.status(401).send({ message: 'Unauthorized' });
    }
    const userService = container_1.default.get('UserService');
    const user = await userService.authenticateUser(token);
    if (!user) {
        return res.status(401).send({ message: 'Unauthorized' });
    }
    if (user.disabled && !user.admin) {
        return res.status(403).send({ message: 'Account is disabled' });
    }
    const studioService = container_1.default.get('StudioService');
    const studios = await studioService.getUserStudios(user.user_id);
    const roles = [user.user_id, ...studios.map((s) => s.user_id)];
    let roleUser = null;
    if (roleCookie && roles.includes(roleCookie)) {
        roleUser = await userService.getUser(roleCookie);
    }
    else {
        roleUser = user;
    }
    req.user = roleUser || user;
    req.originalUser = user;
    next();
};
exports.LoggedCheck = LoggedCheck = __decorate([
    __param(0, (0, inversify_1.inject)('StudioService'))
], LoggedCheck);
