// Auth middleware (spec §11).
import prisma from '../lib/prisma.js';

export function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'UNAUTHENTICATED' });
  }
  next();
}

export function requireRole(role) {
  // Authorize from the user's CURRENT role in the DB, not the role captured in
  // the session at login — so a role change (or deletion) takes effect on the
  // next request instead of waiting for re-login.
  return async (req, res, next) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ error: 'UNAUTHENTICATED' });
      const user = await prisma.user.findUnique({
        where: { id: req.session.userId },
        select: { role: true },
      });
      if (!user) {
        return req.session.destroy(() => res.status(401).json({ error: 'UNAUTHENTICATED' }));
      }
      if (user.role !== role) return res.status(403).json({ error: 'FORBIDDEN' });
      next();
    } catch (err) {
      next(err);
    }
  };
}
