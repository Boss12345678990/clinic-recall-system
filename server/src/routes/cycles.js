import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { getSettings } from '../lib/settings.js';
import { toDateOnly, parseDateOnly } from '../lib/dates.js';
import { STEP_CALLS, CONTACT_STEPS } from '../lib/recall.js';

const router = Router();

// The ContactStep enum only defines up to a 3rd call.
const ENUM_CALL_CAP = 3;
const CALLABLE_STEPS = ['LINE_SENT', 'CALL_1', 'CALL_2'];

function serializeCycle(cycle) {
  return { ...cycle, recallDate: toDateOnly(cycle.recallDate) };
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

function parseId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'INVALID_ID' });
    return null;
  }
  return id;
}

// Map 404/400 sentinels from loadActiveCycle to responses. Returns true if handled.
function handleLoadError(error, res) {
  if (error === 404) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return true;
  }
  if (error === 400) {
    res.status(400).json({ error: 'CYCLE_CLOSED' });
    return true;
  }
  return false;
}

// POST /api/cycles/:id/line — mark the LINE/message as sent (spec §7).
router.post(
  '/:id/line',
  asyncHandler(async (req, res) => {
    const id = parseId(req, res);
    if (id === null) return;

    const { cycle, error } = await loadActiveCycle(id);
    if (handleLoadError(error, res)) return;
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
// advance the step. Only callable from LINE_SENT/CALL_1/CALL_2 and below maxCalls.
router.post(
  '/:id/calls',
  asyncHandler(async (req, res) => {
    const id = parseId(req, res);
    if (id === null) return;

    const { cycle, error } = await loadActiveCycle(id);
    if (handleLoadError(error, res)) return;
    if (!CALLABLE_STEPS.includes(cycle.step)) return res.status(400).json({ error: 'INVALID_STEP' });

    const settings = await getSettings();
    const maxCalls = Math.min(settings.maxCalls, ENUM_CALL_CAP);
    const callsMade = STEP_CALLS[cycle.step] ?? 0;
    if (callsMade >= maxCalls) return res.status(400).json({ error: 'MAX_CALLS_REACHED' });

    const outcome = req.body?.outcome === 'REACHED' ? 'REACHED' : 'NO_ANSWER';
    const note = req.body?.note ? String(req.body.note).trim() : null;
    const attemptNo = callsMade + 1;

    const updated = await prisma.$transaction(async (tx) => {
      await tx.callLog.create({
        data: { cycleId: id, patientId: cycle.patientId, userId: req.session.userId ?? null, attemptNo, outcome, note },
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

// PATCH /api/cycles/:id/step { step, date? } — manually set progress on the
// current round (spec §8). Supports backdating: LINE_SENT sets lineSentAt; a
// CALL step records (or backdates) the matching CallLog so today's-to-do timing
// stays coherent.
router.patch(
  '/:id/step',
  asyncHandler(async (req, res) => {
    const id = parseId(req, res);
    if (id === null) return;

    const { step } = req.body ?? {};
    if (!CONTACT_STEPS.includes(step)) return res.status(400).json({ error: 'INVALID_STEP' });

    let when = null;
    if (req.body?.date != null && req.body.date !== '') {
      try {
        when = parseDateOnly(req.body.date);
      } catch {
        return res.status(400).json({ error: 'INVALID_DATE' });
      }
    }

    const { cycle, error } = await loadActiveCycle(id);
    if (handleLoadError(error, res)) return;

    const callNo = STEP_CALLS[step];

    const updated = await prisma.$transaction(async (tx) => {
      const data = { step };
      if (step === 'NOT_STARTED') data.lineSentAt = null;
      if (step === 'LINE_SENT') data.lineSentAt = when ?? cycle.lineSentAt ?? new Date();

      if (callNo >= 1) {
        const existing = cycle.callLogs.find((l) => l.attemptNo === callNo);
        if (!existing) {
          await tx.callLog.create({
            data: {
              cycleId: id,
              patientId: cycle.patientId,
              userId: req.session.userId ?? null,
              attemptNo: callNo,
              outcome: 'NO_ANSWER',
              note: '手動補登',
              ...(when ? { calledAt: when } : {}),
            },
          });
        } else if (when) {
          await tx.callLog.update({ where: { id: existing.id }, data: { calledAt: when } });
        }
      }

      return tx.recallCycle.update({ where: { id }, data, include: { callLogs: true } });
    });
    res.json(serializeCycle(updated));
  })
);

// PATCH /api/cycles/:id/status { status } — confirm / unconfirm (spec §8).
router.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const id = parseId(req, res);
    if (id === null) return;

    const { status } = req.body ?? {};
    if (!['UNCONFIRMED', 'CONFIRMED'].includes(status)) {
      return res.status(400).json({ error: 'INVALID_STATUS' });
    }

    const { error } = await loadActiveCycle(id);
    if (handleLoadError(error, res)) return;

    const updated = await prisma.recallCycle.update({
      where: { id },
      data: { status },
      include: { callLogs: true },
    });
    res.json(serializeCycle(updated));
  })
);

// POST /api/cycles/:id/close { reason } — stop this round without rescheduling
// (NO_RESPONSE / MANUAL). Rescheduling lives at POST /api/patients/:id/reschedule.
router.post(
  '/:id/close',
  asyncHandler(async (req, res) => {
    const id = parseId(req, res);
    if (id === null) return;

    const { reason } = req.body ?? {};
    if (!['NO_RESPONSE', 'MANUAL'].includes(reason)) {
      return res.status(400).json({ error: 'INVALID_REASON' });
    }

    const { error } = await loadActiveCycle(id);
    if (handleLoadError(error, res)) return;

    const updated = await prisma.recallCycle.update({
      where: { id },
      data: { isActive: false, closedReason: reason },
      include: { callLogs: true },
    });
    res.json(serializeCycle(updated));
  })
);

export default router;
