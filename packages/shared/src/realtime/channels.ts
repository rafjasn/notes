export type ChannelScope = 'public' | 'private-workspace' | 'private-user' | 'presence-workspace';

export interface ParsedChannel {
    scope: ChannelScope;
    workspaceId?: string;
    userId?: string;
    topic: string;
}

export interface FanoutEvent {
    channel: string;
    event: string;
    payload: unknown;
}

export function parseChannel(channel: string): ParsedChannel {
    const parts = channel.split(':');
    const [scope, ownerId, ...topicParts] = parts;
    const topic = topicParts.join(':');

    if (scope === 'public') {
        return {
            scope,
            topic: parts.slice(1).join(':')
        };
    }

    if (scope === 'private-workspace' || scope === 'presence-workspace') {
        if (!ownerId || !topic) {
            throw new Error('Workspace channel must include workspace id and topic');
        }

        return {
            scope,
            workspaceId: ownerId,
            topic
        };
    }

    if (scope === 'private-user') {
        if (!ownerId || !topic) {
            throw new Error('User channel must include user id and topic');
        }

        return {
            scope,
            userId: ownerId,
            topic
        };
    }

    throw new Error(`Unsupported channel scope: ${scope}`);
}

export function isFanoutEvent(value: unknown): value is FanoutEvent {
    const event = value as FanoutEvent;

    return (
        typeof event?.channel === 'string' &&
        typeof event?.event === 'string' &&
        Object.prototype.hasOwnProperty.call(event, 'payload')
    );
}
