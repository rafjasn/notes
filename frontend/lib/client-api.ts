export class ApiError extends Error {
    status: number;
    details: unknown;

    constructor(message: string, status: number, details: unknown) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.details = details;
    }
}

function errorMessage(payload: unknown, fallback: string) {
    if (typeof payload === 'object' && payload !== null && 'message' in payload) {
        const message = (payload as { message?: unknown }).message;
        if (Array.isArray(message)) {
            return message.join(', ');
        }

        if (typeof message === 'string') {
            return message;
        }
    }

    return fallback;
}

async function parseResponse(response: Response) {
    const text = await response.text();
    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text) as unknown;
    } catch {
        return text;
    }
}

export async function apiRequest<T>(
    path: string,
    options: { method?: string; body?: unknown } = {}
): Promise<T> {
    const headers = new Headers();
    const init: RequestInit = {
        method: options.method ?? 'GET',
        credentials: 'include',
        headers
    };

    if (options.body !== undefined) {
        headers.set('content-type', 'application/json');
        init.body = JSON.stringify(options.body);
    }

    const response = await fetch(`/api/bff${path}`, init);
    const payload = await parseResponse(response);

    if (!response.ok) {
        throw new ApiError(errorMessage(payload, 'Request failed'), response.status, payload);
    }

    return payload as T;
}
