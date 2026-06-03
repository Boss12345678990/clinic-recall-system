import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { getSettings } from '../lib/settings.js';
import { toDateOnly } from '../lib/dates.js';

const router = Router();

// The ContactStep enum only defines up to a 3rd call.
const ENUM_CALL_CAP = 3;

function serializeCycle(cycle) {
  return {
    ...cycle,
    recallDate: toDateOnly(cycle.recallDate),
  };
}

async function loadActiveCycle(id) {
  const cycle = await prisma.recallCycle.findUnique({
    where: { id },
    include: { callLogs: true },
  });
  if (!cycle) return { error: 404 };
  if (!cycle.isActive) return { error: 400 };
  return { cycle };
}

// POST /api/cycles/:id/line — mark the LINE/message as sent (spec §7).
router.post(
  '/:id/line',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'INVALID_ID' });

    const { cycle, error } = await loadActiveCycle(id);
    if (error === 404) return res.status(404).json({ error: 'NOT_FOUND' });
    if (error === 400) return res.status(400).json({ error: 'CYCLE_CLOSED' });
    if (cycle.step !== 'NOT_STARTED') return res.status(400).json({ error: 'INVALID_STEP' });

    const updated = await prisma.recallCycle.update({
      where: { id },
      data: { step: 'LINE_SENT', lineSentAt: new Date() },
      include: { callLogs: true },
    });
    res.json(serializeCycle(updated));
  })
);

// POST /api/cycles/:id/calls { note?, outcome? } — record a call attempt and
// advance the step (CALL_1/2/3). Blocked once the call limit is reached.
router.post(
  '/:id/calls',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'INVALID_ID' });

    const { cycle, error } = await loadActiveCycle(id);
    if (error === 404) return res.status(404).json({ error: 'NOT_FOUND' });
    if (error === 400) return res.status(400).json({ error: 'CYCLE_CLOSED' });

    const settings = await getSettings();
    const maxCalls = Math.min(settings.maxCalls, ENUM_CALL_CAP);
    const callsMade = cycle.callLogs.length;
    if (callsMade >= maxCalls) return res.status(400).json({ error: 'MAX_CALLS_REACHED' });

    const outcome = req.body?.outcome === 'REACHED' ? 'REACHED' : 'NO_ANSWER';
    const note = req.body?.note ? String(req.body.note).trim() : null;
    const attemptNo = callsMade + 1;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.callLog.create({
        data: {
          cycleId: id,
          patientId: cycle.patientId,
          userId: req.session.userId ?? null,
          attemptNo,
          outcome,
          note,
        },
      });
      return tx.recallCycle.update({
        where: { id },
        data: { step: `CALL_${attemptNo}` },
        include: { callLogs: true },
      });
    });

    res.status(201).json(serializeCycle(updated));
  })
);

export default router;
