import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';

// Session middleware backed by PostgreSQL (connect-pg-simple).
// Sessions survive server restarts so staff are not logged out on redeploy.
export function buildSessionMiddleware() {
  const PgStore = connectPgSimple(session);

  const isProd = process.env.NODE_ENV === 'production';

  return session({
    store: new PgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true, // auto-create the "session" table
    }),
    name: 'clinic.sid',
    secret: process.env.SESSION_SECRET || 'dev-insecure-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd, // requires HTTPS in production (spec §11)
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
  });
}
