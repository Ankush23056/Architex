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

// ── AI Analysis Route ─────────────────────────────────────────
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

app.post('/api/analyze', async (req, res) => {
  try {
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

    const chatCompletion = await groq.chat.completions.create({
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

    let result;
    try {
      result = JSON.parse(chatCompletion.choices[0].message.content);
    } catch (parseError) {
      console.error('Groq JSON parsing error:', parseError);
      return res.status(500).json({ error: 'AI returned malformed JSON.' });
    }

    res.json(result);
  } catch (error) {
    console.error('Groq Analysis Error:', error);
    res.status(500).json({ error: 'Failed to analyze architecture' });
  }
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
