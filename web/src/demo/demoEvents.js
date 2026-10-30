const sockets = new Set();

export function createDemoSocket() {
  const listeners = new Map();
  const socket = {
    connected: false,
    _listeners: listeners,
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
      if (event === 'connect') queueMicrotask(() => {
        if (!sockets.has(socket)) return;
        socket.connected = true;
        handler();
      });
      return socket;
    },
    removeAllListeners() {
      listeners.clear();
      return socket;
    },
    disconnect() {
      if (socket.connected) {
        socket.connected = false;
        for (const handler of listeners.get('disconnect') ?? []) handler();
      }
      sockets.delete(socket);
      return socket;
    },
  };
  sockets.add(socket);
  return socket;
}

export function emitDemoEvent(event, payload) {
  for (const socket of sockets) {
    for (const handler of socket._listeners?.get(event) ?? []) handler(payload);
  }
}
