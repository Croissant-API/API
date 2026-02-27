export interface IMailService {
    sendPasswordResetMail(to: string, resetLink: string): Promise<void>;
    sendAccountConfirmationMail(to: string, confirmationLink: string): Promise<void>;
    sendConnectionNotificationMail(to: string, username: string): Promise<void>;
    initialize(): Promise<void>;
}
export declare class MailService implements IMailService {
    private transporter;
    private isInitialized;
    constructor();
    initialize(): Promise<void>;
    private ensureInitialized;
    private sendTemplateMail;
    sendPasswordResetMail(to: string, resetToken: string): Promise<void>;
    sendAccountConfirmationMail(to: string): Promise<void>;
    sendConnectionNotificationMail(to: string, username: string): Promise<void>;
}
