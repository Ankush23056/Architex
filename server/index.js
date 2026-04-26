import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const REDIS_KEY = 'architex:canvas_state';

// Initialize Redis
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('[REDIS] Error:', err));
await redisClient.connect();
console.log('[REDIS] Connected successfully');

app.use(cors());
app.use(express.json());

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', clients: wss.clients.size, timestamp: Date.now() });
});

const httpServer = createServer(app);

// ── WebSocket Server ──────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer });

// Load initial state from Redis, fallback to empty array
let canvasState = { elements: [] };
try {
  const storedState = await redisClient.get(REDIS_KEY);
  if (storedState) {
    canvasState = JSON.parse(storedState);
    console.log('[REDIS] Loaded initial state');
  }
} catch (err) {
  console.error('[REDIS] Failed to load initial state', err);
}

wss.on('connection', (ws) => {
  const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  console.log(`[WS] Connected: ${clientId} | Total: ${wss.clients.size}`);

  // Send full canvas state to newly connected client
  ws.send(JSON.stringify({
    type: 'CANVAS_SYNC',
    payload: canvasState,
    clientId: 'server',
  }));

  ws.on('message', (rawData) => {
    let msg;
    try {
      msg = JSON.parse(rawData.toString());
    } catch {
      console.error('[WS] Invalid JSON received');
      return;
    }

    const { type, payload } = msg;
    let stateChanged = false;

    // Update server-side state
    switch (type) {
      case 'ELEMENT_ADD':
        canvasState.elements.push(payload);
        stateChanged = true;
        break;
      case 'ELEMENT_UPDATE':
        canvasState.elements = canvasState.elements.map((el) =>
          el.id === payload.id ? { ...el, ...payload } : el
        );
        stateChanged = true;
        break;
      case 'ELEMENTS_UPDATE_BULK': {
        const updateMap = new Map(payload.map(el => [el.id, el]));
        canvasState.elements = canvasState.elements.map(el => 
          updateMap.has(el.id) ? { ...el, ...updateMap.get(el.id) } : el
        );
        stateChanged = true;
        break;
      }
      case 'ELEMENT_DELETE':
        canvasState.elements = canvasState.elements.filter((el) => el.id !== payload.id);
        stateChanged = true;
        break;
      case 'CANVAS_CLEAR':
        canvasState.elements = [];
        stateChanged = true;
        break;
      case 'CURSOR_UPDATE':
        // Cursor updates are ephemeral and not saved to Redis
        break;
      default:
        break;
    }

    // Persist to Redis asynchronously if state changed
    if (stateChanged) {
      redisClient.set(REDIS_KEY, JSON.stringify(canvasState)).catch(err => {
        console.error('[REDIS] Failed to save state', err);
      });
    }

    // Broadcast to all OTHER clients
    const outbound = JSON.stringify({ ...msg, clientId });
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === 1) {
        client.send(outbound);
      }
    });
  });

  ws.on('close', () => {
    console.log(`[WS] Disconnected: ${clientId} | Total: ${wss.clients.size}`);
    // Broadcast disconnect so clients can remove their cursor
    const outbound = JSON.stringify({ type: 'USER_DISCONNECT', clientId });
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === 1) {
        client.send(outbound);
      }
    });
  });

  ws.on('error', (err) => {
    console.error(`[WS] Error on ${clientId}:`, err.message);
  });
});

httpServer.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════╗`);
  console.log(`  ║   ARCHITEX SERVER  ·  port ${PORT}      ║`);
  console.log(`  ║   WebSocket ready for connections    ║`);
  console.log(`  ╚══════════════════════════════════════╝\n`);
});
