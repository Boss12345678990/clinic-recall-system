import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { getSettings, validateSettingsPatch } from '../lib/settings.js';

const router = Router();

// GET /api/settings — effective settings (any authenticated user).
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await getSettings());
  })
);

// PUT /api/settings — update settings (ADMIN). Body is a partial patch.
router.put(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    let rows;
    try {
      rows = validateSettingsPatch(req.body);
    } catch {
      return res.status(400).json({ error: 'INVALID_SETTING' });
    }

    await prisma.$transaction(
      rows.map((row) =>
        prisma.setting.upsert({
          where: { key: row.key },
          update: { value: row.value },
          create: row,
        })
      )
    );

    res.json(await getSettings());
  })
);

export default router;
