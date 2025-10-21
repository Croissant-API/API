import ejs from 'ejs';
import { injectable } from 'inversify';
import nodemailer, { Transporter } from 'nodemailer';
import path from 'path';

export interface IMailService {
  sendPasswordResetMail(to: string, resetLink: string): Promise<void>;
  sendAccountConfirmationMail(to: string, confirmationLink: string): Promise<void>;
  sendConnectionNotificationMail(to: string, username: string): Promise<void>;
  initialize(): Promise<void>;
}

@injectable()
export class MailService implements IMailService {
  private transporter: Transporter | null = null;
  private isInitialized: boolean = false;

  constructor() {
    // Ne pas créer le transporter dans le constructeur
  }

  public async initialize(): Promise<void> {
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

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private async sendTemplateMail(to: string, template: string, subject: string, data?: Record<string, unknown>) {
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
