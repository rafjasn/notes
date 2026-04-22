import { Injectable, Logger } from '@nestjs/common';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

function staticAwsCredentials() {
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        return {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        };
    }

    if (process.env.NODE_ENV !== 'production' && process.env.AWS_ENDPOINT) {
        return {
            accessKeyId: 'test',
            secretAccessKey: 'test'
        };
    }

    return undefined;
}

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private readonly transporter?: Transporter;
    private readonly ses?: SESv2Client;

    constructor(private readonly config: ConfigService) {
        const host = config.get<string>('app.mail.host');

        if (host) {
            this.transporter = nodemailer.createTransport({
                host,
                port: config.get<number>('app.mail.port', 1025),
                secure: false,
                ...(config.get<string>('app.mail.user')
                    ? {
                          auth: {
                              user: config.get<string>('app.mail.user'),
                              pass: config.get<string>('app.mail.password')
                          }
                      }
                    : {})
            });

            return;
        }

        if (config.get<string>('app.mail.transport') === 'ses') {
            this.ses = new SESv2Client({
                region: config.get<string>('app.aws.region', 'us-east-1'),
                endpoint: config.get<string>('app.aws.endpoint'),
                credentials: staticAwsCredentials()
            });
        }
    }

    private async sendMail(to: string, subject: string, text: string): Promise<void> {
        const from = this.config.get<string>('app.mail.from');

        if (this.transporter) {
            await this.transporter.sendMail({ from, to, subject, text });

            return;
        }

        if (this.ses) {
            await this.ses.send(
                new SendEmailCommand({
                    FromEmailAddress: from,
                    Destination: { ToAddresses: [to] },
                    Content: {
                        Simple: {
                            Subject: { Data: subject },
                            Body: { Text: { Data: text } }
                        }
                    }
                })
            );

            return;
        }

        this.logger.log(`${subject} for ${to}: ${text}`);
    }

    async sendOtp(to: string, code: string): Promise<void> {
        await this.sendMail(to, 'Your verification code', `Your code is: ${code}`);
    }

    async sendMagicLink(to: string, link: string): Promise<void> {
        await this.sendMail(to, 'Your sign-in link', `Click to sign in: ${link}`);
    }

    async sendPasswordReset(to: string, link: string): Promise<void> {
        await this.sendMail(
            to,
            'Reset your password',
            `Click to reset your password: ${link}\n\nThis link expires in 15 minutes.`
        );
    }

    async sendInvitation(to: string, workspaceName: string, inviteUrl: string): Promise<void> {
        await this.sendMail(
            to,
            `You were invited to ${workspaceName}`,
            `Accept your invitation: ${inviteUrl}`
        );
    }
}
