import path from 'path';

// dynamic import of Node-only libraries; these will be undefined in edge environments
let ejs: any;
let nodemailer: any;
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
  ejs = require('ejs');
  nodemailer = require('nodemailer');
}

// dotenv is not used in edge runtime; credentials must be provided by environment variables

export interface IMailService {
  sendPasswordResetMail(to: string, resetLink: string): Promise<void>;
  sendAccountConfirmationMail(to: string, confirmationLink: string): Promise<void>;
}
console.log(process.env)
export class MailService implements IMailService {
  private transporter: any;

  constructor() {
    if (nodemailer) {
      this.transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      // running in edge environment, no transport available
      this.transporter = null;
    }
  }

  private async sendTemplateMail(to: string, template: string, subject: string, data?: Record<string, unknown>) {
    if (!this.transporter) {
      // no-op when running in edge environment
      return;
    }
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
