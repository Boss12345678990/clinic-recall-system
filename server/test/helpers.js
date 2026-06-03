import session from 'express-session';
import { createApp } from '../src/app.js';

// Build the app with an in-memory session store so tests need no Postgres.
export function makeTestApp() {
  const sessionMiddleware = session({
    name: 'clinic.sid',
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
  });
  return createApp({ sessionMiddleware });
}
