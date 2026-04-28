import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { createClient } from 'redis';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';


dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const REDIS_KEY = 'architex:canvas_state';

// Initialize Redis — with try/catch to prevent server crashes on cloud connection blips
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 3) {
        console.log('[REDIS] Giving up reconnecting. Running without persistence.');
        return false;
      }
      return Math.min(retries * 200, 1000);
    }
  }
});

redisClient.on('error', (err) => console.error('[REDIS] Error:', err.message));

(async () => {
  try {
    await redisClient.connect();
    console.log('[REDIS] Connected successfully');
  } catch (err) {
    console.error('[REDIS] Initial connection failed:', err.message);
  }
})();

// Explicit CORS: allow the Vite dev server and any deployed frontend
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', '*'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', clients: wss.clients.size, timestamp: Date.now() });
});

// ── AI Analysis Route ─────────────────────────────────────────
app.post('/api/analyze', async (req, res) => {
  console.log('[AI] Request received. Elements count:', req.body?.elements?.length ?? 0);
  try {
    if (!process.env.GROQ_API_KEY) {
      console.error('[AI] GROQ_API_KEY is not set in .env');
      return res.status(500).json({ error: 'GROQ_API_KEY is missing from the server environment.' });
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const { elements, context } = req.body;
    
    // Logic: Extract all text labels and connections from the elements array.
    const texts = elements.filter(e => e.type === 'text');
    const curves = elements.filter(e => e.type === 'curve');

    const findTextNear = (x, y) => {
      let closest = null;
      let minDist = 200; // Threshold distance
      for (const t of texts) {
        // Approximate center of text box
        const cx = t.x + (t.text.length * t.strokeWidth * 3);
        const cy = t.y + (t.strokeWidth * 6);
        const dist = Math.hypot(x - cx, y - cy);
        if (dist < minDist) {
          minDist = dist;
          closest = t.text;
        }
      }
      return closest;
    };

    const components = texts.map(t => t.text);
    const connections = [];

    curves.forEach(c => {
      const startText = findTextNear(c.x, c.y);
      const endText = findTextNear(c.x + c.width, c.y + c.height);
      if (startText && endText && startText !== endText) {
        connections.push(`${startText} connects to ${endText}`);
      }
    });

    const promptMessage = `Context: ${context || 'General Software Architecture'}
    
Components detected:
${components.map(c => `- ${c}`).join('\n')}

Connections detected:
${connections.map(c => `- ${c}`).join('\n')}

Please analyze this architecture based on the provided stack/context.
`;

    let chatCompletion;
    try {
      chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: "You are an elite System Architect. Analyze the following components and connections. Return a JSON object with: 1. 'analysis' (3 bullet points of high-level feedback), 2. 'missing' (an array of strings representing missing production-grade components, e.g., 'Load Balancer', 'Redis Cache', 'WAF'). DO NOT wrap the output in markdown code blocks like ```json ... ```, just output the raw JSON."
          },
          {
            role: 'user',
            content: promptMessage,
          }
        ],
        model: 'llama3-70b-8192',
        temperature: 0.2,
        response_format: { type: 'json_object' }
      });
      console.log('[AI] Groq response received successfully.');
    } catch (groqError) {
      console.error('[AI] Groq API call failed:', groqError.message);
      return res.status(503).json({ error: 'AI Service Unavailable. Check your GROQ_API_KEY.' });
    }

    let result;
    try {
      result = JSON.parse(chatCompletion.choices[0].message.content);
    } catch (parseError) {
      console.error('[AI] Groq JSON parse error:', parseError);
      return res.status(500).json({ error: 'AI returned malformed JSON.' });
    }

    console.log('[AI] Sending result to client:', JSON.stringify(result).slice(0, 100));
    res.json(result);
  } catch (error) {
    console.error('[AI] Unexpected error:', error.message);
    res.status(500).json({ error: 'Failed to analyze architecture: ' + error.message });
  }
});

const httpServer = createServer(app);

// ── WebSocket Server ──────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer });

// Load initial state from Redis, fallback to empty array
let canvasState = { elements: [] };

wss.on('connection', async (ws) => {
  const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  console.log(`[WS] Connected: ${clientId} | Total: ${wss.clients.size}`);

  // Fetch the latest board state from Redis on every new connection
  if (redisClient.isOpen) {
    try {
      const storedState = await redisClient.get(REDIS_KEY);
      if (storedState) {
        canvasState = JSON.parse(storedState);
        console.log(`[REDIS] Fetched latest state for ${clientId}`);
        
        // Emit special init-state event to the newly connected socket
        ws.send(JSON.stringify({
          type: 'init-state',
          payload: canvasState,
          clientId: 'server',
        }));
        return; // We sent init-state, so we can return early
      }
    } catch (err) {
      console.error('[REDIS] Failed to load state for new client', err.message);
    }
  }

  // If Redis fetch failed or returned null, send whatever we have in memory
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
      case 'CANVAS_SYNC':
        if (payload && Array.isArray(payload.elements)) {
          canvasState.elements = payload.elements;
          stateChanged = true;
        }
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
