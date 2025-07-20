"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const ejs_1 = __importDefault(require("ejs"));
const path_1 = __importDefault(require("path"));
class MailService {
    constructor() {
        this.transporter = nodemailer_1.default.createTransport({
            host: process.env.SMTP_HOST || 'ssl0.ovh.net',
            port: Number(process.env.SMTP_PORT) || 465,
            secure: true,
            auth: {
                user: process.env.SMTP_USER || 'contact@croissant-api.fr',
                pass: process.env.SMTP_PASS,
            }
        });
    }
    async sendPasswordResetMail(to, resetToken) {
        const templatePath = path_1.default.join(process.cwd(), 'mailTemplates', 'passwordReset.ejs');
        const html = await ejs_1.default.renderFile(templatePath, { resetToken });
        const mailOptions = {
            from: process.env.SMTP_FROM || 'Croissant API <contact@croissant-api.fr>',
            to,
            subject: 'Password Reset Request',
            html
        };
        await this.transporter.sendMail(mailOptions);
    }
    async sendAccountConfirmationMail(to) {
        const templatePath = path_1.default.join(process.cwd(), 'mailTemplates', 'accountConfirmation.ejs');
        const html = await ejs_1.default.renderFile(templatePath);
        const mailOptions = {
            from: process.env.SMTP_FROM || 'Croissant API <contact@croissant-api.fr>',
            to,
            subject: 'Account Creation notification',
            html
        };
        await this.transporter.sendMail(mailOptions);
    }
    async sendConnectionNotificationMail(to, username) {
        const templatePath = path_1.default.join(process.cwd(), 'mailTemplates', 'connectionNotification.ejs');
        const html = await ejs_1.default.renderFile(templatePath, { username });
        const mailOptions = {
            from: process.env.SMTP_FROM || 'Croissant API <contact@croissant-api.fr>',
            to,
            subject: 'New login to your account',
            html
        };
        this.transporter.sendMail(mailOptions).then(() => {
            console.log(`Connection notification sent to ${to}`);
        }).catch(error => {
            console.error(`Failed to send connection notification to ${to}:`, error);
        });
    }
}
exports.MailService = MailService;
