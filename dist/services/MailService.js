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
            host: process.env.SMTP_HOST || "mail.croissant-api.fr",
            port: Number(process.env.SMTP_PORT) || 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER || "contact@croissant-api.fr",
                pass: process.env.SMTP_PASS,
            },
        });
    }
    async sendTemplateMail(to, template, subject, data) {
        const templatePath = path_1.default.join(process.cwd(), "mailTemplates", template);
        const html = await ejs_1.default.renderFile(templatePath, data || {});
        const mailOptions = {
            from: process.env.SMTP_FROM || "Croissant API <contact@croissant-api.fr>",
            to,
            subject,
            html,
        };
        await this.transporter.sendMail(mailOptions);
    }
    async sendPasswordResetMail(to, resetToken) {
        await this.sendTemplateMail(to, "passwordReset.ejs", "Password Reset Request", { resetToken });
    }
    async sendAccountConfirmationMail(to) {
        await this.sendTemplateMail(to, "accountConfirmation.ejs", "Account Creation notification");
    }
    async sendConnectionNotificationMail(to, username) {
        await this.sendTemplateMail(to, "connectionNotification.ejs", "New login to your account", { username });
    }
}
exports.MailService = MailService;
