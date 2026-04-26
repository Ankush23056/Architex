import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', clients: wss.clients.size, timestamp: Date.now() });
});

const httpServer = createServer(app);

// ── WebSocket Server ──────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer });

// In-memory canvas state for new clients joining mid-session
let canvasState = { elements: [] };

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

    // Update server-side state
    switch (type) {
      case 'ELEMENT_ADD':
        canvasState.elements.push(payload);
        break;
      case 'ELEMENT_UPDATE':
        canvasState.elements = canvasState.elements.map((el) =>
          el.id === payload.id ? { ...el, ...payload } : el
        );
        break;
      case 'ELEMENT_DELETE':
        canvasState.elements = canvasState.elements.filter((el) => el.id !== payload.id);
        break;
      case 'CANVAS_CLEAR':
        canvasState.elements = [];
        break;
      default:
        break;
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
