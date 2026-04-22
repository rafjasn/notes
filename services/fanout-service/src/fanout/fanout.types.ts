export interface SocketUser {
    userId: string;
    email: string;
    claims?: Record<string, unknown>;
}

export interface SubscribePayload {
    channel: string;
}
