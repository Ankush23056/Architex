import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import { createClient } from 'redis';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE_FALLBACK = path.join(__dirname, 'canvas_state.json');

const app = express();
const PORT = process.env.PORT || 3001;
const REDIS_KEY = 'architex:canvas_state';

// ── Persistence helpers (Redis → file fallback) ───────────────
async function saveState(state) {
  // Try Redis first
  if (redisClient.isOpen) {
    try {
      await redisClient.set(REDIS_KEY, JSON.stringify(state));
      return;
    } catch (err) {
      console.warn('[PERSIST] Redis save failed, falling back to file:', err.message);
    }
  }
  // Fallback: write to local JSON file
  try {
    fs.writeFileSync(FILE_FALLBACK, JSON.stringify(state));
  } catch (err) {
    console.error('[PERSIST] File save failed:', err.message);
  }
}

async function loadState() {
  // Try Redis first
  if (redisClient.isOpen) {
    try {
      const stored = await redisClient.get(REDIS_KEY);
      if (stored) {
        console.log('[PERSIST] Loaded state from Redis');
        return JSON.parse(stored);
      }
    } catch (err) {
      console.warn('[PERSIST] Redis load failed, falling back to file:', err.message);
    }
  }
  // Fallback: read from local JSON file
  if (fs.existsSync(FILE_FALLBACK)) {
    try {
      const stored = fs.readFileSync(FILE_FALLBACK, 'utf8');
      console.log('[PERSIST] Loaded state from file fallback');
      return JSON.parse(stored);
    } catch (err) {
      console.error('[PERSIST] File load failed:', err.message);
    }
  }
  return null;
}

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
    const { connections, components, context } = req.body;
    
    // Fallback if no components or map provided
    const mapStr = connections || 'No explicit connections found';
    const compStr = Array.isArray(components) ? components.join(', ') : 'None';

    const promptMessage = `Connections: ${mapStr}\n\nAll Components detected: ${compStr}\nContext: ${context || 'Software Architecture'}`;

    let chatCompletion;
    try {
      chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: "Act as a No-Nonsense Lead Architect. Rules: 1. Max 50 words total. 2. Use bullet points. 3. If you see an arrow from A to B, acknowledge the 'Flow'. 4. Do not define terms like MERN. 5. Only suggest 2 missing component. Return a JSON object with: 1. 'analysis' (array of strings, bullet points of feedback), 2. 'missing' (array of exactly 2 strings representing missing production-grade components). DO NOT wrap the output in markdown code blocks like ```json ... ```, just output the raw JSON."
          },
          {
            role: 'user',
            content: promptMessage,
          }
        ],
        model: 'llama-3.3-70b-versatile',
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

// ── Sharing Routes ────────────────────────────────────────────
app.post('/api/share', async (req, res) => {
  try {
    const { elements } = req.body;
    if (!elements || !Array.isArray(elements)) {
      return res.status(400).json({ error: 'Invalid elements array' });
    }

    // Generate 6-char slug
    const slug = Math.random().toString(36).substring(2, 8);
    const key = `board:${slug}`;

    if (redisClient.isOpen) {
      // Expire in 7 days (604800 seconds) to prevent infinite bloat
      await redisClient.set(key, JSON.stringify({ elements }), { EX: 604800 });
      return res.json({ slug });
    } else {
      // Fallback for local
      const shareDir = path.join(__dirname, 'shares');
      if (!fs.existsSync(shareDir)) fs.mkdirSync(shareDir);
      fs.writeFileSync(path.join(shareDir, `${slug}.json`), JSON.stringify({ elements }));
      return res.json({ slug });
    }
  } catch (err) {
    console.error('[SHARE] Save failed:', err.message);
    res.status(500).json({ error: 'Failed to create share link' });
  }
});

app.get('/api/share/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const key = `board:${slug}`;

    if (redisClient.isOpen) {
      const data = await redisClient.get(key);
      if (data) return res.json(JSON.parse(data));
    } else {
      // Fallback
      const sharePath = path.join(__dirname, 'shares', `${slug}.json`);
      if (fs.existsSync(sharePath)) {
        return res.json(JSON.parse(fs.readFileSync(sharePath, 'utf8')));
      }
    }
    
    return res.status(404).json({ error: 'Share not found' });
  } catch (err) {
    console.error('[SHARE] Load failed:', err.message);
    res.status(500).json({ error: 'Failed to load share' });
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

  // Load latest state from Redis or file fallback
  const stored = await loadState();
  if (stored) canvasState = stored;

  // Send state to the newly connected client
  ws.send(JSON.stringify({
    type: 'init-state',
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
      case 'ELEMENTS_DELETE_BULK':
        canvasState.elements = canvasState.elements.filter((el) => !payload.includes(el.id));
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

    // Persist to Redis or file fallback if state changed
    if (stateChanged) {
      saveState(canvasState).catch(err => {
        console.error('[PERSIST] Failed to save state', err);
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
