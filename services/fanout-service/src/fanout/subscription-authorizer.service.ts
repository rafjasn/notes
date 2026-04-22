import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseChannel } from '@notes/shared';

@Injectable()
export class SubscriptionAuthorizerService {
    constructor(private readonly config: ConfigService) {}

    async authorize(token: string, channel: string): Promise<void> {
        const parsed = parseChannel(channel);

        if (parsed.scope === 'public') {
            return;
        }

        const response = await fetch(
            `${this.config.get<string>('fanout.apiBaseUrl')}/realtime/authorize`,
            {
                method: 'POST',
                headers: {
                    authorization: `Bearer ${token}`,
                    'content-type': 'application/json'
                },
                body: JSON.stringify({ channel })
            }
        );

        if (!response.ok) {
            throw new ForbiddenException('Subscription rejected by API');
        }
    }
}
