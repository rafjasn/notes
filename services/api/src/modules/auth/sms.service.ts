import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';

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
export class SmsService {
    private readonly logger = new Logger(SmsService.name);
    private readonly client: SNSClient;
    private readonly shouldLogOnly: boolean;

    constructor(config: ConfigService) {
        const region = config.get<string>('app.aws.region', 'us-east-1');
        const endpoint = config.get<string>('app.aws.endpoint');

        this.client = new SNSClient({
            region,
            ...(endpoint ? { endpoint } : {}),
            credentials: staticAwsCredentials()
        });

        this.shouldLogOnly =
            process.env.NODE_ENV !== 'production' &&
            !process.env.AWS_ACCESS_KEY_ID &&
            !process.env.AWS_ENDPOINT;
    }

    async sendOtp(phone: string, code: string): Promise<void> {
        const message = `Your verification code is: ${code}`;

        if (this.shouldLogOnly) {
            this.logger.log(`SMS to ${phone}: ${message}`);

            return;
        }

        await this.client.send(
            new PublishCommand({
                PhoneNumber: phone,
                Message: message,
                MessageAttributes: {
                    'AWS.SNS.SMS.SMSType': {
                        DataType: 'String',
                        StringValue: 'Transactional'
                    }
                }
            })
        );
    }
}
