import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
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
  if (redisClient.isOpen) {
    try {
      await redisClient.set(REDIS_KEY, JSON.stringify(state));
      return;
    } catch (err) {
      console.warn('[PERSIST] Redis save failed:', err.message);
    }
  }
  try {
    fs.writeFileSync(FILE_FALLBACK, JSON.stringify(state));
  } catch (err) {
    console.error('[PERSIST] File save failed:', err.message);
  }
}

async function loadState() {
  if (redisClient.isOpen) {
    try {
      const stored = await redisClient.get(REDIS_KEY);
      if (stored) return JSON.parse(stored);
    } catch (err) {
      console.warn('[PERSIST] Redis load failed:', err.message);
    }
  }
  if (fs.existsSync(FILE_FALLBACK)) {
    try {
      return JSON.parse(fs.readFileSync(FILE_FALLBACK, 'utf8'));
    } catch (err) {
      console.error('[PERSIST] File load failed:', err.message);
    }
  }
  return null;
}

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 200, 1000)
  }
});

redisClient.on('error', (err) => console.error('[REDIS] Error:', err.message));
(async () => {
  try { await redisClient.connect(); } catch (err) { console.error('[REDIS] Connection failed'); }
})();

app.use(cors());
app.use(express.json());

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', clients: io.engine.clientsCount, timestamp: Date.now() });
});

// ── AI Analysis Route ─────────────────────────────────────────
app.post('/api/analyze', async (req, res) => {
  try {
    if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY is missing' });
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const { connections, components, context } = req.body;
    const promptMessage = `Connections: ${connections || 'None'}\nComponents: ${components?.join(', ') || 'None'}\nContext: ${context || 'Software Architecture'}`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: "You are a Senior System Architect. Analyze the provided diagram connections. Do NOT assume a specific tech stack (like MERN) unless explicitly labeled in the diagram. If the diagram is generic, provide generic architectural feedback. Focus on: 1. Potential bottlenecks, 2. Missing logical links, 3. Security gaps. Keep responses under 40 words." },
        { role: 'user', content: promptMessage }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });
    res.json(JSON.parse(chatCompletion.choices[0].message.content));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ── Sharing Routes ────────────────────────────────────────────
app.post('/api/share', async (req, res) => {
  try {
    const { elements } = req.body;
    const slug = Math.random().toString(36).substring(2, 8);
    const key = `board:${slug}`;
    if (redisClient.isOpen) {
      await redisClient.set(key, JSON.stringify({ elements }), { EX: 604800 });
    } else {
      const shareDir = path.join(__dirname, 'shares');
      if (!fs.existsSync(shareDir)) fs.mkdirSync(shareDir);
      fs.writeFileSync(path.join(shareDir, `${slug}.json`), JSON.stringify({ elements }));
    }
    res.json({ slug });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create share' });
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
      const sharePath = path.join(__dirname, 'shares', `${slug}.json`);
      if (fs.existsSync(sharePath)) return res.json(JSON.parse(fs.readFileSync(sharePath, 'utf8')));
    }
    res.status(404).json({ error: 'Not found' });
  } catch (err) {
    res.status(500).json({ error: 'Load failed' });
  }
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const CALLSIGNS = ["VIPER", "TITAN", "NEON", "KRAKEN", "SPECTER", "SHADOW", "GHOST", "STRIKER", "PHANTOM", "COBRA"];
let canvasState = { elements: [] };

io.on('connection', async (socket) => {
  const getUniqueUsername = () => {
    const base = CALLSIGNS[Math.floor(Math.random() * CALLSIGNS.length)];
    let name = base, count = 1;
    const taken = Array.from(io.sockets.sockets.values()).map(s => s.username);
    while (taken.includes(name)) { name = `${base}-${count++}`; }
    return name;
  };

  socket.username = getUniqueUsername();
  const clientId = socket.username;

  console.log(`[SOCKET] Connected: ${clientId} | Total: ${io.engine.clientsCount}`);

  const stored = await loadState();
  if (stored) canvasState = stored;

  socket.emit('message', { type: 'IDENTITY', payload: { username: clientId } });
  socket.emit('message', { type: 'init-state', payload: canvasState, clientId: 'server' });

  socket.on('message', async (msg) => {
    const { type, payload } = msg;
    let stateChanged = false;

    switch (type) {
      case 'ELEMENT_ADD':
        canvasState.elements.push(payload);
        stateChanged = true;
        break;
      case 'ELEMENTS_ADD_BULK':
        canvasState.elements.push(...payload);
        stateChanged = true;
        break;
      case 'ELEMENT_UPDATE':
        canvasState.elements = canvasState.elements.map(el => el.id === payload.id ? { ...el, ...payload } : el);
        stateChanged = true;
        break;
      case 'ELEMENTS_UPDATE_BULK': {
        const updateMap = new Map(payload.map(el => [el.id, el]));
        canvasState.elements = canvasState.elements.map(el => updateMap.has(el.id) ? { ...el, ...updateMap.get(el.id) } : el);
        stateChanged = true;
        break;
      }
      case 'ELEMENT_DELETE':
        canvasState.elements = canvasState.elements.filter(el => el.id !== payload.id);
        stateChanged = true;
        break;
      case 'ELEMENTS_DELETE_BULK':
        canvasState.elements = canvasState.elements.filter(el => !payload.includes(el.id));
        stateChanged = true;
        break;
      case 'CANVAS_CLEAR':
        canvasState.elements = [];
        stateChanged = true;
        break;
      case 'CANVAS_SYNC':
        if (payload?.elements) { canvasState.elements = payload.elements; stateChanged = true; }
        break;
      case 'CURSOR_UPDATE':
        // Use volatile broadcast for mouse movements to prevent backlogs
        socket.volatile.broadcast.emit('message', { ...msg, clientId });
        return; // Skip standard broadcast and persistence
    }

    if (stateChanged) saveState(canvasState);
    socket.broadcast.emit('message', { ...msg, clientId });
  });

  socket.on('disconnect', () => {
    console.log(`[SOCKET] Disconnected: ${clientId}`);
    socket.broadcast.emit('message', { type: 'USER_DISCONNECT', clientId });
  });
});

httpServer.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════╗`);
  console.log(`  ║   ARCHITEX SERVER  ·  port ${PORT}      ║`);
  console.log(`  ║   WebSocket ready for connections    ║`);
  console.log(`  ╚══════════════════════════════════════╝\n`);
});
