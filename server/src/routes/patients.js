import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { parseDateOnly, toDateOnly } from '../lib/dates.js';
import { computeRecallDate } from '../lib/recall.js';

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
    let data;
    try {
      data = parsePatientInput(req.body, { partial: false });
    } catch (err) {
      if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
      throw err;
    }

    const recallDate = computeRecallDate(data.lastVisit ?? null, data.intervalMonths);

    const patient = await prisma.$transaction(async (tx) => {
      const created = await tx.patient.create({ data });
      if (data.lastVisit) {
        await tx.visit.create({
          data: { patientId: created.id, visitDate: data.lastVisit },
        });
        await tx.recallCycle.create({
          data: { patientId: created.id, recallDate },
        });
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

      const activeCycle = existing.recallCycles[0];
      if (recallInputsChanged && activeCycle && activeCycle.step === 'NOT_STARTED') {
        const lastVisit = data.lastVisit !== undefined ? data.lastVisit : existing.lastVisit;
        const interval =
          data.intervalMonths !== undefined ? data.intervalMonths : existing.intervalMonths;
        const recallDate = computeRecallDate(lastVisit, interval);
        if (recallDate) {
          await tx.recallCycle.update({ where: { id: activeCycle.id }, data: { recallDate } });
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
