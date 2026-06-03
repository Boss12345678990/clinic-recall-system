import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

const SELECT = { id: true, username: true, displayName: true, role: true, createdAt: true };
const MIN_PASSWORD = 6;

// All account management is ADMIN-only (spec §3).
router.use(requireRole('ADMIN'));

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await prisma.user.findMany({ select: SELECT, orderBy: { id: 'asc' } }));
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { username, password, displayName, role } = req.body ?? {};
    if (!username || typeof username !== 'string') return res.status(400).json({ error: 'USERNAME_REQUIRED' });
    if (!password || String(password).length < MIN_PASSWORD) {
      return res.status(400).json({ error: 'WEAK_PASSWORD' });
    }
    if (role && !['ADMIN', 'STAFF'].includes(role)) return res.status(400).json({ error: 'INVALID_ROLE' });

    try {
      const user = await prisma.user.create({
        data: {
          username: username.trim(),
          passwordHash: await bcrypt.hash(String(password), 12),
          displayName: displayName?.trim() || null,
          role: role || 'STAFF',
        },
        select: SELECT,
      });
      res.status(201).json(user);
    } catch (err) {
      if (err.code === 'P2002') return res.status(409).json({ error: 'USERNAME_TAKEN' });
      throw err;
    }
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'INVALID_ID' });

    const { displayName, role, password } = req.body ?? {};
    const data = {};
    if (displayName !== undefined) data.displayName = displayName?.trim() || null;
    if (role !== undefined) {
      if (!['ADMIN', 'STAFF'].includes(role)) return res.status(400).json({ error: 'INVALID_ROLE' });
      data.role = role;
    }
    if (password !== undefined) {
      if (String(password).length < MIN_PASSWORD) return res.status(400).json({ error: 'WEAK_PASSWORD' });
      data.passwordHash = await bcrypt.hash(String(password), 12);
    }

    try {
      const user = await prisma.user.update({ where: { id }, data, select: SELECT });
      res.json(user);
    } catch (err) {
      if (err.code === 'P2025') return res.status(404).json({ error: 'NOT_FOUND' });
      throw err;
    }
  })
);

export default router;
