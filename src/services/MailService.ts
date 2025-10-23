import ejs from 'ejs';
import nodemailer from 'nodemailer';
import path from 'path';

import { config } from 'dotenv';
config();

export interface IMailService {
  sendPasswordResetMail(to: string, resetLink: string): Promise<void>;
  sendAccountConfirmationMail(to: string, confirmationLink: string): Promise<void>;
}

export class MailService implements IMailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

  }

  private async sendTemplateMail(to: string, template: string, subject: string, data?: Record<string, unknown>) {
    const templatePath = path.join(process.cwd(), 'mailTemplates', template);
    const html = await ejs.renderFile(templatePath, data || {});
    const mailOptions = {
      from: process.env.SMTP_FROM || 'Croissant API <support@croissant-api.fr>',
      to,
      subject,
      html,
    };
    await this.transporter.sendMail(mailOptions);
  }

  async sendPasswordResetMail(to: string, resetToken: string) {
    await this.sendTemplateMail(to, 'passwordReset.ejs', 'Password Reset Request', { resetToken });
  }

  async sendAccountConfirmationMail(to: string) {
    await this.sendTemplateMail(to, 'accountConfirmation.ejs', 'Account Creation notification');
  }

  async sendConnectionNotificationMail(to: string, username: string) {
    await this.sendTemplateMail(to, 'connectionNotification.ejs', 'New login to your account', { username });
  }
}
