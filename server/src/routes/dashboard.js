import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { getSettings } from '../lib/settings.js';
import { groupTodayRecalls } from '../lib/recall.js';
import { localToday } from '../lib/dates.js';
import { upcomingBirthdays } from '../lib/birthdays.js';

const router = Router();

// GET /api/dashboard — today's bucket counts, active patient total, and
// upcoming birthdays (spec F11).
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const today = localToday();
    const [settings, cycles, totalActive, birthdayPatients] = await Promise.all([
      getSettings(),
      prisma.recallCycle.findMany({
        where: { isActive: true, patient: { status: 'ACTIVE' } },
        include: { patient: true, callLogs: true },
      }),
      prisma.patient.count({ where: { status: 'ACTIVE' } }),
      prisma.patient.findMany({
        where: { status: 'ACTIVE', birthday: { not: null } },
        select: { id: true, name: true, phone: true, birthday: true },
      }),
    ]);

    const groups = groupTodayRecalls(cycles, settings, today);
    res.json({
      counts: {
        needLine: groups.needLine.length,
        needCall: groups.needCall.length,
        confirmed: groups.confirmed.length,
        unreachable: groups.unreachable.length,
      },
      totalActive,
      birthdays: upcomingBirthdays(birthdayPatients, today, 7),
    });
  })
);

export default router;
