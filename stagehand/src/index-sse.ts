#!/usr/bin/env node

import express from 'express';
// @ts-ignore
import cors from 'cors';
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createServer, ApiKeys, closeSession } from "./server.js";
import { ensureLogDirectory, registerExitHandlers, scheduleLogRotation, setupLogRotation } from "./logging.js";
import { cleanupSessionScreenshots } from "./resources.js";

// Run setup for logging
ensureLogDirectory();
setupLogRotation();
scheduleLogRotation();
registerExitHandlers();

// Create Express server
const app = express();
app.use(cors());

// Apply JSON middleware to all routes except /messages
app.use((req, res, next) => {
  if (req.path === '/messages') {
    return next();
  }
  express.json()(req, res, next);
});

// Extract API keys from headers or query parameters
function extractApiKeys(req: express.Request): ApiKeys {
  const getFirstString = (value: unknown): string | undefined => {
    if (Array.isArray(value)) return value[0];
    if (typeof value === 'string') return value;
    return undefined;
  };

  const browserbaseApiKey =
    getFirstString(req.query.browserbase_api_key) ||
    getFirstString(req.headers['x-browserbase-api-key']) ||
    process.env.BROWSERBASE_API_KEY;

  const browserbaseProjectId =
    getFirstString(req.query.browserbase_project_id) ||
    getFirstString(req.headers['x-browserbase-project-id']) ||
    process.env.BROWSERBASE_PROJECT_ID;

  const openaiApiKey =
    getFirstString(req.query.openai_api_key) ||
    getFirstString(req.headers['x-openai-api-key']) ||
    process.env.OPENAI_API_KEY;

  return {
    browserbaseApiKey,
    browserbaseProjectId,
    openaiApiKey,
  };
}

// Store active sessions
const sessions: Record<string, { transport: SSEServerTransport; response: express.Response }> = {};

// SSE endpoint
// SSE endpoint
app.get('/sse', async (req, res) => {
  console.log(`🛰️ New SSE connection from ${req.ip || 'unknown'}`);

  // Helper para obtener string
  function getFirstString(value: unknown): string | undefined {
    if (Array.isArray(value)) return value[0];
    if (typeof value === 'string') return value;
    return undefined;
  }

  // Extraer claves desde headers, query o env
  function extractApiKeys(req: express.Request): ApiKeys {
    const browserbaseApiKey =
      getFirstString(req.query.browserbase_api_key) ||
      getFirstString(req.headers['x-browserbase-api-key']) ||
      process.env.BROWSERBASE_API_KEY;

    const browserbaseProjectId =
      getFirstString(req.query.browserbase_project_id) ||
      getFirstString(req.headers['x-browserbase-project-id']) ||
      process.env.BROWSERBASE_PROJECT_ID;

    const openaiApiKey =
      getFirstString(req.query.openai_api_key) ||
      getFirstString(req.headers['x-openai-api-key']) ||
      process.env.OPENAI_API_KEY;

    // LOG: Mostrar de dónde viene cada uno
    console.log('🔍 API Key sources:');
    console.log(`browserbase_api_key: query=${req.query.browserbase_api_key}, header=${req.headers['x-browserbase-api-key']}, env=${!!process.env.BROWSERBASE_API_KEY}`);
    console.log(`browserbase_project_id: query=${req.query.browserbase_project_id}, header=${req.headers['x-browserbase-project-id']}, env=${!!process.env.BROWSERBASE_PROJECT_ID}`);
    console.log(`openai_api_key: query=${req.query.openai_api_key}, header=${req.headers['x-openai-api-key']}, env=${!!process.env.OPENAI_API_KEY}`);

    return {
      browserbaseApiKey,
      browserbaseProjectId,
      openaiApiKey,
    };
  }

  try {
    const apiKeys = extractApiKeys(req);

    if (!apiKeys.browserbaseApiKey || !apiKeys.browserbaseProjectId || !apiKeys.openaiApiKey) {
      console.warn('⚠️ Missing required API keys:', apiKeys);
      res.status(401).send(
        'Missing required API keys. Provide via headers, query params, or env variables.'
      );
      return;
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sseTransport = new SSEServerTransport('/messages', res);

    const server = createServer(apiKeys);
    await server.connect(sseTransport);

    const sessionId = sseTransport.sessionId;
    if (sessionId) {
      sessions[sessionId] = { transport: sseTransport, response: res };
      console.log(`✅ SSE session established: ${sessionId}`);

      sseTransport.onclose = () => {
        console.log(`❌ SSE session closed: ${sessionId}`);
        delete sessions[sessionId];
      };

      sseTransport.onerror = (err) => {
        console.error(`🔥 SSE error (${sessionId}):`, err);
        delete sessions[sessionId];
      };

      req.on('close', () => {
        console.log(`📴 Client disconnected: ${sessionId}`);
        closeSession(apiKeys).catch(err => console.error('Error closing session:', err));
        delete sessions[sessionId];
        cleanupSessionScreenshots(sessionId);
      });
    } else {
      throw new Error("❗ Failed to obtain session ID from transport");
    }
  } catch (error) {
    console.error('❗ SSE handler error:', error);
    res.status(500).send(`Server error: ${error instanceof Error ? error.message : String(error)}`);
  }
});


// Message endpoint
app.post('/messages', (req, res) => {
  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
    res.status(400).send('Missing sessionId parameter');
    return;
  }
  const session = sessions[sessionId];
  if (session?.transport?.handlePostMessage) {
    console.log(`POST to SSE transport (session ${sessionId})`);
    try {
      session.transport.handlePostMessage(req, res).catch(err => {
        console.error(`Error handling message for session ${sessionId}:`, err);
        if (!res.headersSent) res.status(500).send('Internal server error');
      });
    } catch (error) {
      console.error(`Error handling message for session ${sessionId}:`, error);
      if (!res.headersSent) res.status(500).send('Internal server error');
    }
  } else {
    res.status(503).send(`No active SSE connection for session ${sessionId}`);
  }
});

// Root endpoint
app.get('/', (_req, res) => {
  res.send('✅ MCP Server is alive');
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.send('ok');
});

// Start the server
const PORT = parseInt(process.env.PORT || '8080', 10);
app.listen(PORT, () => {
  console.log(`MCP SSE Server running on port ${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`Message endpoint: http://localhost:${PORT}/messages?sessionId={sessionId}`);
});
