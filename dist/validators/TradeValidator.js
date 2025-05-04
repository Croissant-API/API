"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tradeItemActionSchema = exports.tradeApproveSchema = exports.tradeStatusSchema = exports.tradeSchema = exports.tradeItemSchema = void 0;
const yup = __importStar(require("yup"));
exports.tradeItemSchema = yup.object({
    itemId: yup.string().required(),
    amount: yup.number().integer().min(1).required(),
});
exports.tradeSchema = yup.object({
    id: yup.number().integer().required(),
    fromUserId: yup.string().required(),
    toUserId: yup.string().required(),
    fromUserItems: yup.array().of(exports.tradeItemSchema).required(),
    toUserItems: yup.array().of(exports.tradeItemSchema).required(),
    approvedFromUser: yup.boolean().required(),
    approvedToUser: yup.boolean().required(),
    status: yup.string().oneOf(["pending", "completed", "canceled"]).required(),
});
exports.tradeStatusSchema = yup.object({
    status: yup.string().oneOf(["pending", "completed", "canceled"]).required(),
});
exports.tradeApproveSchema = yup.object({
// No body expected
});
exports.tradeItemActionSchema = yup.object({
    userKey: yup.string().oneOf(["fromUserItems", "toUserItems"]).required(),
    tradeItem: exports.tradeItemSchema.required(),
});
