import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    DeleteMessageCommand,
    Message,
    ReceiveMessageCommand,
    SQSClient
} from '@aws-sdk/client-sqs';
import { FanoutEvent, isFanoutEvent } from '@notes/shared';
import { FanoutGateway } from './fanout.gateway';

interface SnsEnvelope {
    Message?: string;
}

@Injectable()
export class FanoutService implements OnModuleInit {
    private readonly sqs: SQSClient;
    private readonly queueUrl: string;
    private polling = false;

    constructor(
        private readonly config: ConfigService,
        private readonly gateway: FanoutGateway
    ) {
        this.sqs = new SQSClient({
            region: config.get<string>('fanout.aws.region'),
            endpoint: config.get<string>('fanout.aws.endpoint'),
            credentials: config.get('fanout.aws.credentials')
        });
        this.queueUrl = config.get<string>('fanout.aws.queueUrl')!;
    }

    onModuleInit(): void {
        this.polling = true;
        void this.poll();
    }

    private async poll(): Promise<void> {
        while (this.polling) {
            try {
                const result = await this.sqs.send(
                    new ReceiveMessageCommand({
                        QueueUrl: this.queueUrl,
                        MaxNumberOfMessages: 10,
                        WaitTimeSeconds: 20
                    })
                );

                for (const message of result.Messages ?? []) {
                    await this.processMessage(message);
                }
            } catch (error) {
                console.error('Fanout SQS polling error:', error);
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }
        }
    }

    private async processMessage(message: Message): Promise<void> {
        const event = this.parseMessage(message);
        if (!event) {
            await this.deleteMessage(message);

            return;
        }

        this.gateway.broadcast(event.channel, event.event, event.payload);
        await this.deleteMessage(message);
    }

    private async deleteMessage(message: Message): Promise<void> {
        await this.sqs.send(
            new DeleteMessageCommand({
                QueueUrl: this.queueUrl,
                ReceiptHandle: message.ReceiptHandle
            })
        );
    }

    private parseMessage(message: Message): FanoutEvent | null {
        try {
            const body = JSON.parse(message.Body ?? '{}') as SnsEnvelope | FanoutEvent;
            const candidate =
                typeof (body as SnsEnvelope).Message === 'string'
                    ? JSON.parse((body as SnsEnvelope).Message!)
                    : body;

            return isFanoutEvent(candidate) ? candidate : null;
        } catch (error) {
            console.error('Invalid fanout message:', error);
            return null;
        }
    }
}
