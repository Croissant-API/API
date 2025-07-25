import nodemailer from "nodemailer";
import ejs from "ejs";
import path from "path";

export interface IMailService {
  sendPasswordResetMail(to: string, resetLink: string): Promise<void>;
  sendAccountConfirmationMail(
    to: string,
    confirmationLink: string
  ): Promise<void>;
}

export class MailService implements IMailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "ssl0.ovh.net",
      port: Number(process.env.SMTP_PORT) || 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER || "contact@croissant-api.fr",
        pass: process.env.SMTP_PASS,
      },
    });
  }

  private async sendTemplateMail(
    to: string,
    template: string,
    subject: string,
    data?: Record<string, unknown>
  ) {
    const templatePath = path.join(process.cwd(), "mailTemplates", template);
    const html = await ejs.renderFile(templatePath, data || {});
    const mailOptions = {
      from: process.env.SMTP_FROM || "Croissant API <contact@croissant-api.fr>",
      to,
      subject,
      html,
    };
    await this.transporter.sendMail(mailOptions);
  }

  async sendPasswordResetMail(to: string, resetToken: string) {
    await this.sendTemplateMail(
      to,
      "passwordReset.ejs",
      "Password Reset Request",
      { resetToken }
    );
  }

  async sendAccountConfirmationMail(to: string) {
    await this.sendTemplateMail(
      to,
      "accountConfirmation.ejs",
      "Account Creation notification"
    );
  }

  async sendConnectionNotificationMail(to: string, username: string) {
    await this.sendTemplateMail(
      to,
      "connectionNotification.ejs",
      "New login to your account",
      { username }
    );
  }
}
