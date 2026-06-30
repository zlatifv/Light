import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { WebSocketServer } from 'ws';
import { attachSignalingServer, getConnectedUserCount } from './ws/signalingServer.js';
import { registerAuthRoutes } from './routes/auth.js';

const PORT = Number(process.env.PORT) || 3001;
const ALLOWED_ORIGIN = process.env.WEB_ORIGIN || 'http://localhost:5173';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: ALLOWED_ORIGIN,
});

await registerAuthRoutes(app);

app.get('/health', async () => ({
  status: 'ok',
  connectedUsers: getConnectedUserCount(),
}));

app.get('/', async () => ({
  service: 'light-backend',
  status: 'running',
}));

// Start the HTTP server first, then attach a raw `ws` WebSocketServer to
// the same underlying Node http.Server instance on path /ws.
// This lets one Render Web Service handle both REST and WebSocket traffic
// on the same port — no separate service needed.
const address = await app.listen({ port: PORT, host: '0.0.0.0' });
app.log.info(`Fastify listening at ${address}`);

const wss = new WebSocketServer({ server: app.server, path: '/ws' });
attachSignalingServer(wss);
app.log.info('WebSocket signaling server attached at /ws');
