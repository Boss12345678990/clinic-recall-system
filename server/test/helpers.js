import session from 'express-session';
import { createApp } from '../src/app.js';

// Belt-and-suspenders: ensure test-mode behavior (e.g. the login rate-limiter
// skip) even if the runner didn't set NODE_ENV. The limiter reads this per
// request, so setting it here (before any request) is sufficient.
process.env.NODE_ENV = 'test';

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
