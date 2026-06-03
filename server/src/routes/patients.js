import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { parseDateOnly, toDateOnly } from '../lib/dates.js';
import { computeRecallDate } from '../lib/recall.js';
import { getSettings } from '../lib/settings.js';

const router = Router();

const DEFAULT_INTERVAL = 6;

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Validate + normalize patient input. `partial` (PATCH) only checks provided
// keys; throws ValidationError on bad input. Returns a Prisma-ready data object.
function parsePatientInput(body = {}, { partial = false } = {}) {
  const data = {};

  if (!partial || body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) throw new ValidationError('NAME_REQUIRED');
    data.name = name;
  }

  if (body.phone !== undefined) {
    data.phone = body.phone ? String(body.phone).trim() : null;
  }
  if (body.notes !== undefined) {
    data.notes = body.notes ? String(body.notes).trim() : null;
  }

  if (body.birthday !== undefined) {
    try {
      data.birthday = parseDateOnly(body.birthday);
    } catch {
      throw new ValidationError('INVALID_BIRTHDAY');
    }
  }
  if (body.lastVisit !== undefined) {
    try {
      data.lastVisit = parseDateOnly(body.lastVisit);
    } catch {
      throw new ValidationError('INVALID_LAST_VISIT');
    }
  }

  if (!partial || body.intervalMonths !== undefined) {
    const interval =
      body.intervalMonths === undefined || body.intervalMonths === null || body.intervalMonths === ''
        ? DEFAULT_INTERVAL
        : Number(body.intervalMonths);
    if (!Number.isInteger(interval) || interval <= 0) {
      throw new ValidationError('INVALID_INTERVAL');
    }
    data.intervalMonths = interval;
  }

  if (body.status !== undefined) {
    if (!['ACTIVE', 'ARCHIVED'].includes(body.status)) throw new ValidationError('INVALID_STATUS');
    data.status = body.status;
  }

  return data;
}

// A patient "enters recall tracking" by getting a Visit (the known last visit)
// plus an active RecallCycle. Shared by create and the patch-adds-lastVisit path
// so both behave identically.
async function seedRecallTracking(tx, patientId, lastVisit, recallDate) {
  await tx.visit.create({ data: { patientId, visitDate: lastVisit } });
  await tx.recallCycle.create({ data: { patientId, recallDate } });
}

function serializePatient(patient) {
  if (!patient) return null;
  const activeCycle = patient.recallCycles?.find((c) => c.isActive) ?? null;
  return {
    id: patient.id,
    name: patient.name,
    phone: patient.phone,
    birthday: toDateOnly(patient.birthday),
    lastVisit: toDateOnly(patient.lastVisit),
    intervalMonths: patient.intervalMonths,
    status: patient.status,
    notes: patient.notes,
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
    recallDate: activeCycle ? toDateOnly(activeCycle.recallDate) : null,
  };
}

// GET /api/patients?q=  — search by name (case-insensitive) or phone.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
          ],
        }
      : {};

    const patients = await prisma.patient.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { recallCycles: { where: { isActive: true }, take: 1 } },
    });

    res.json(patients.map(serializePatient));
  })
);

// POST /api/patients — create. If lastVisit is given, also seed a Visit and an
// active RecallCycle so the patient enters the recall flow (spec F3).
router.post(
  '/',
  asyncHandler(async (req, res) => {
    // Default the interval from the configured setting when the caller omits it.
    const body = { ...req.body };
    if (body.intervalMonths === undefined || body.intervalMonths === null || body.intervalMonths === '') {
      const settings = await getSettings();
      body.intervalMonths = settings.defaultInterval;
    }

    let data;
    try {
      data = parsePatientInput(body, { partial: false });
    } catch (err) {
      if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
      throw err;
    }

    const recallDate = computeRecallDate(data.lastVisit ?? null, data.intervalMonths);

    const patient = await prisma.$transaction(async (tx) => {
      const created = await tx.patient.create({ data });
      if (data.lastVisit) {
        await seedRecallTracking(tx, created.id, data.lastVisit, recallDate);
      }
      return tx.patient.findUnique({
        where: { id: created.id },
        include: { recallCycles: { where: { isActive: true }, take: 1 } },
      });
    });

    res.status(201).json(serializePatient(patient));
  })
);

// GET /api/patients/:id — patient + active cycle + history (visits, all cycles).
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'INVALID_ID' });

    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        recallCycles: { orderBy: { createdAt: 'desc' }, include: { callLogs: true } },
        visits: { orderBy: { visitDate: 'desc' } },
      },
    });
    if (!patient) return res.status(404).json({ error: 'NOT_FOUND' });

    const activeCycle = patient.recallCycles.find((c) => c.isActive) ?? null;
    res.json({
      ...serializePatient(patient),
      activeCycle: activeCycle
        ? { ...activeCycle, recallDate: toDateOnly(activeCycle.recallDate) }
        : null,
      visits: patient.visits.map((v) => ({ ...v, visitDate: toDateOnly(v.visitDate) })),
      cycles: patient.recallCycles.map((c) => ({ ...c, recallDate: toDateOnly(c.recallDate) })),
    });
  })
);

// PATCH /api/patients/:id — update demographic fields. If lastVisit or
// intervalMonths change, recompute the recall date of an as-yet-untouched
// (NOT_STARTED) active cycle so it stays derived. Progressed cycles are left
// alone — moving them is handled by reschedule (Phase 3).
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'INVALID_ID' });

    let data;
    try {
      data = parsePatientInput(req.body, { partial: true });
    } catch (err) {
      if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
      throw err;
    }

    const existing = await prisma.patient.findUnique({
      where: { id },
      include: { recallCycles: { where: { isActive: true }, take: 1 } },
    });
    if (!existing) return res.status(404).json({ error: 'NOT_FOUND' });

    const recallInputsChanged = data.lastVisit !== undefined || data.intervalMonths !== undefined;

    const patient = await prisma.$transaction(async (tx) => {
      await tx.patient.update({ where: { id }, data });

      if (recallInputsChanged) {
        const lastVisit = data.lastVisit !== undefined ? data.lastVisit : existing.lastVisit;
        const interval =
          data.intervalMonths !== undefined ? data.intervalMonths : existing.intervalMonths;
        const recallDate = computeRecallDate(lastVisit, interval);
        const activeCycle = existing.recallCycles[0];

        if (activeCycle) {
          // Only adjust an untouched cycle; progressed ones are reschedule
          // territory (Phase 3) and must not move silently.
          if (activeCycle.step === 'NOT_STARTED') {
            if (recallDate) {
              await tx.recallCycle.update({ where: { id: activeCycle.id }, data: { recallDate } });
            } else {
              // lastVisit cleared -> the cycle has no anchor; retire it so it
              // stops showing a stale recall date.
              await tx.recallCycle.update({
                where: { id: activeCycle.id },
                data: { isActive: false, closedReason: 'MANUAL' },
              });
            }
          }
        } else if (recallDate) {
          // No active cycle yet, but a lastVisit was just added -> enter tracking.
          await seedRecallTracking(tx, id, lastVisit, recallDate);
        }
      }

      return tx.patient.findUnique({
        where: { id },
        include: { recallCycles: { where: { isActive: true }, take: 1 } },
      });
    });

    res.json(serializePatient(patient));
  })
);

// POST /api/patients/:id/reschedule { visitDate, intervalMonths? } — the
// "confirmed recall -> book next" flow (spec §7/§8): close the current round as
// CONFIRMED_BOOKED, record the booked visit, update lastVisit/interval, and open
// a fresh active cycle anchored on the new visit.
router.post(
  '/:id/reschedule',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'INVALID_ID' });

    let visitDate;
    try {
      visitDate = parseDateOnly(req.body?.visitDate);
    } catch {
      return res.status(400).json({ error: 'INVALID_VISIT_DATE' });
    }
    if (!visitDate) return res.status(400).json({ error: 'VISIT_DATE_REQUIRED' });

    const patient = await prisma.patient.findUnique({
      where: { id },
      include: { recallCycles: { where: { isActive: true }, take: 1 } },
    });
    if (!patient) return res.status(404).json({ error: 'NOT_FOUND' });

    // Rescheduling is the "confirmed -> book next" step: the active round must
    // already be confirmed (spec §7's 待約下次 state), so an in-progress,
    // unconfirmed round can't be silently skipped.
    const active = patient.recallCycles[0];
    if (!active) return res.status(400).json({ error: 'NO_ACTIVE_CYCLE' });
    if (active.status !== 'CONFIRMED') return res.status(400).json({ error: 'NOT_CONFIRMED' });

    const raw = req.body?.intervalMonths;
    const interval = raw === undefined || raw === null || raw === '' ? patient.intervalMonths : Number(raw);
    if (!Number.isInteger(interval) || interval <= 0) {
      return res.status(400).json({ error: 'INVALID_INTERVAL' });
    }
    const recallDate = computeRecallDate(visitDate, interval);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.recallCycle.update({
        where: { id: active.id },
        data: { isActive: false, closedReason: 'CONFIRMED_BOOKED' },
      });
      await tx.patient.update({ where: { id }, data: { lastVisit: visitDate, intervalMonths: interval } });
      await tx.visit.create({ data: { patientId: id, visitDate } });
      await tx.recallCycle.create({ data: { patientId: id, recallDate } });

      return tx.patient.findUnique({
        where: { id },
        include: { recallCycles: { where: { isActive: true }, take: 1 } },
      });
    });

    res.status(201).json(serializePatient(updated));
  })
);

// DELETE /api/patients/:id — hard delete (cascades to visits/cycles/callLogs).
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'INVALID_ID' });

    try {
      await prisma.patient.delete({ where: { id } });
    } catch (err) {
      if (err.code === 'P2025') return res.status(404).json({ error: 'NOT_FOUND' });
      throw err;
    }
    res.status(204).end();
  })
);

export default router;
