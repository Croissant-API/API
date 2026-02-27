var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import ejs from 'ejs';
import { injectable } from 'inversify';
import nodemailer from 'nodemailer';
import path from 'path';
let MailService = class MailService {
    constructor() {
        this.transporter = null;
        this.isInitialized = false;
        // Ne pas créer le transporter dans le constructeur
    }
    async initialize() {
        if (!this.isInitialized) {
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'mail.croissant-api.fr',
                port: Number(process.env.SMTP_PORT) || 587,
                secure: false, // true for 465, false for other ports
                auth: {
                    user: process.env.SMTP_USER || 'noreply@croissant-api.fr',
                    pass: process.env.SMTP_PASS,
                },
            });
            this.isInitialized = true;
        }
    }
    async ensureInitialized() {
        if (!this.isInitialized) {
            await this.initialize();
        }
    }
    async sendTemplateMail(to, template, subject, data) {
        await this.ensureInitialized();
        const templatePath = path.join(process.cwd(), 'mailTemplates', template);
        const html = await ejs.renderFile(templatePath, data || {});
        const mailOptions = {
            from: process.env.SMTP_FROM || 'Croissant API <noreply@croissant-api.fr>',
            to,
            subject,
            html,
        };
        if (!this.transporter) {
            throw new Error('Mail service is not properly initialized');
        }
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
};
MailService = __decorate([
    injectable(),
    __metadata("design:paramtypes", [])
], MailService);
export { MailService };
