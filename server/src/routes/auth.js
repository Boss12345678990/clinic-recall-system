import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import prisma from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

// Brute-force protection on login (spec §11): 15 min window, max 10 attempts.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TOO_MANY_ATTEMPTS' },
});

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ error: 'MISSING_CREDENTIALS' });
  }

  const user = await prisma.user.findUnique({ where: { username } });
  // Compare even when user is missing to avoid leaking which usernames exist.
  const hash = user?.passwordHash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const ok = await bcrypt.compare(password, hash);

  if (!user || !ok) {
    return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
  }

  req.session.userId = user.id;
  req.session.role = user.role;

  res.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  });
}));

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('clinic.sid');
    res.json({ ok: true });
  });
});

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    select: { id: true, username: true, displayName: true, role: true },
  });
  if (!user) {
    return req.session.destroy(() => res.status(401).json({ error: 'UNAUTHENTICATED' }));
  }
  res.json(user);
}));

export default router;
