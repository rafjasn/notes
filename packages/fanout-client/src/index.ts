import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';

interface FanoutEvent {
    channel: string;
    event: string;
    payload: unknown;
}

export interface FanoutClientOptions {
    topicArn: string;
    region?: string;
    endpoint?: string;
    credentials?: {
        accessKeyId: string;
        secretAccessKey: string;
    };
}

export class FanoutClient {
    private readonly client: SNSClient;

    constructor(private readonly options: FanoutClientOptions) {
        this.client = new SNSClient({
            region: options.region ?? 'us-east-1',
            endpoint: options.endpoint,
            credentials: options.credentials
        });
    }

    async trigger(channel: string, event: string, payload: unknown): Promise<void> {
        const message: FanoutEvent = { channel, event, payload };

        await this.client.send(
            new PublishCommand({
                TopicArn: this.options.topicArn,
                Message: JSON.stringify(message),
                MessageAttributes: {
                    channel: { DataType: 'String', StringValue: channel },
                    event: { DataType: 'String', StringValue: event }
                }
            })
        );
    }
}
