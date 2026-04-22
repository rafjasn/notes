'use client';

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

function socketUrl() {
    return process.env.NEXT_PUBLIC_WS_URL?.trim() || window.location.origin;
}

export function getSocket() {
    if (!socket) {
        socket = io(socketUrl(), {
            autoConnect: false,
            path: '/socket.io',
            transports: ['websocket', 'polling'],
            withCredentials: true
        });
    }

    return socket;
}

export function subscribeToChannel(channel: string, onEvent: () => void) {
    const activeSocket = getSocket();
    const subscribe = () => {
        activeSocket.emit('subscribe', { channel });
    };

    activeSocket.on('note.created', onEvent);
    activeSocket.on('note.updated', onEvent);
    activeSocket.on('note.deleted', onEvent);
    activeSocket.on('connect', subscribe);

    if (activeSocket.connected) {
        subscribe();
    } else {
        activeSocket.connect();
    }

    return () => {
        activeSocket.off('connect', subscribe);

        if (activeSocket.connected) {
            activeSocket.emit('unsubscribe', { channel });
        }

        activeSocket.off('note.created', onEvent);
        activeSocket.off('note.updated', onEvent);
        activeSocket.off('note.deleted', onEvent);
    };
}
