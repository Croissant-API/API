"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailService = void 0;
const path_1 = __importDefault(require("path"));
// dynamic import of Node-only libraries; these will be undefined in edge environments
let ejs;
let nodemailer;
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
    ejs = require('ejs');
    nodemailer = require('nodemailer');
}
console.log(process.env);
class MailService {
    constructor() {
        if (nodemailer) {
            this.transporter = nodemailer.createTransport({
                service: "gmail",
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });
        }
        else {
            // running in edge environment, no transport available
            this.transporter = null;
        }
    }
    async sendTemplateMail(to, template, subject, data) {
        if (!this.transporter) {
            // no-op when running in edge environment
            return;
        }
        const templatePath = path_1.default.join(process.cwd(), 'mailTemplates', template);
        const html = await ejs.renderFile(templatePath, data || {});
        const mailOptions = {
            from: process.env.SMTP_FROM || 'Croissant API <support@croissant-api.fr>',
            to,
            subject,
            html,
        };
        await this.transporter.sendMail(mailOptions);
    }
    async sendPasswordResetMail(to, resetToken) {
        await this.sendTemplateMail(to, 'passwordReset.ejs', 'Password Reset Request', { resetToken });
    }
    async sendAccountConfirmationMail(to) {
        await this.sendTemplateMail(to, 'accountConfirmation.ejs', 'Account Creation notification');
    }
    async sendConnectionNotificationMail(to, username) {
        await this.sendTemplateMail(to, 'connectionNotification.ejs', 'New login to your account', { username });
    }
}
exports.MailService = MailService;
