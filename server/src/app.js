import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSessionMiddleware } from './lib/session.js';
import { requireAuth } from './middleware/auth.js';
import authRouter from './routes/auth.js';
import patientsRouter from './routes/patients.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse TRUST_PROXY env into a value express's "trust proxy" setting accepts.
// Unset/false -> false (don't trust). A number -> trust that many hops.
function parseTrustProxy(value) {
  if (!value || value === 'false' || value === '0') return false;
  if (value === 'true') return 1;
  const n = Number(value);
  return Number.isInteger(n) ? n : value;
}

/**
 * Build the Express app. Kept separate from index.js so tests can import the
 * app without opening a listening socket.
 *
 * @param {object} [opts]
 * @param {import('express').RequestHandler} [opts.sessionMiddleware] override for tests
 */
export function createApp({ sessionMiddleware } = {}) {
  const app = express();

  // Only trust X-Forwarded-* when a reverse proxy is actually in front of us
  // (e.g. Caddy/nginx terminating TLS). On a direct LAN deployment leave this
  // off, otherwise clients could spoof X-Forwarded-For and bypass the IP-based
  // login rate limiter. Configure via TRUST_PROXY ("1", "true", or a hop count).
  app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));

  app.use(express.json());
  app.use(sessionMiddleware ?? buildSessionMiddleware());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRouter);
  app.use('/api/patients', requireAuth, patientsRouter);

  // In production, serve the built client (same-origin, spec §5).
  if (process.env.NODE_ENV === 'production') {
    const clientDist = path.resolve(__dirname, '../../client/dist');
    app.use(express.static(clientDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // Centralized error handler: keeps the process alive on unexpected failures
  // (e.g. a rejected DB query forwarded by asyncHandler) and returns a 500.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    // eslint-disable-next-line no-console
    console.error(err);
    if (res.headersSent) return;
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  });

  return app;
}
