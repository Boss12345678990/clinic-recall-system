// Auth middleware (spec §11).

export function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'UNAUTHENTICATED' });
  }
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: 'UNAUTHENTICATED' });
    }
    if (req.session.role !== role) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    next();
  };
}
