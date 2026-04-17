// Browser shim for isomorphic-ws.
// The browser has WebSocket natively; this shim exposes it as both default
// and named exports so that `import * as ws from 'isomorphic-ws'` works
// and `ws.WebSocket` resolves to the global WebSocket.
export const WebSocket = globalThis.WebSocket;
export default globalThis.WebSocket;
