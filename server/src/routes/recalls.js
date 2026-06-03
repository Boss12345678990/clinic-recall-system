import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { getSettings } from '../lib/settings.js';
import { groupTodayRecalls } from '../lib/recall.js';
import { todayUTC } from '../lib/dates.js';

const router = Router();

// GET /api/recalls/today — the front desk's day, grouped into four buckets
// (spec §7). Considers active cycles of still-tracked (ACTIVE) patients.
router.get(
  '/today',
  asyncHandler(async (_req, res) => {
    const [settings, cycles] = await Promise.all([
      getSettings(),
      prisma.recallCycle.findMany({
        where: { isActive: true, patient: { status: 'ACTIVE' } },
        include: { patient: true, callLogs: true },
      }),
    ]);

    res.json(groupTodayRecalls(cycles, settings, todayUTC()));
  })
);

export default router;
