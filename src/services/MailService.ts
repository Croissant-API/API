

import nodemailer from 'nodemailer';
import ejs from 'ejs';
import path from 'path';

export interface IMailService {
    sendPasswordResetMail(to: string, resetLink: string): Promise<void>;
    sendAccountConfirmationMail(to: string, confirmationLink: string): Promise<void>;
}

export class MailService implements IMailService {
    private transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'ssl0.ovh.net',
            port: Number(process.env.SMTP_PORT) || 465,
            secure: true, // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER || 'contact@croissant-api.fr',
                pass: process.env.SMTP_PASS || 'OVHtipouf2010',
            }
        });
    }


    async sendPasswordResetMail(to: string, resetToken: string) {
        const templatePath = path.join(process.cwd(), 'mailTemplates', 'passwordReset.ejs');
        const html = await ejs.renderFile(templatePath, { resetToken });
        const mailOptions = {
            from: process.env.SMTP_FROM || 'Croissant API <contact@croissant-api.fr>',
            to,
            subject: 'Password Reset Request',
            html
        };
        await this.transporter.sendMail(mailOptions);
    }


    async sendAccountConfirmationMail(to: string) {
        const templatePath = path.join(process.cwd(), 'mailTemplates', 'accountConfirmation.ejs');
        const html = await ejs.renderFile(templatePath);
        const mailOptions = {
            from: process.env.SMTP_FROM || 'Croissant API <contact@croissant-api.fr>',
            to,
            subject: 'Account Creation notification',
            html
        };
        await this.transporter.sendMail(mailOptions);
    }

    async sendConnectionNotificationMail(to: string, username: string) {
        const templatePath = path.join(process.cwd(), 'mailTemplates', 'connectionNotification.ejs');
        const html = await ejs.renderFile(templatePath, { username });
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
