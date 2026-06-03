import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';

// Mock the shared Prisma client. $transaction runs its callback with the same
// mock acting as the transaction client.
const prismaMock = {
  user: { findUnique: vi.fn() },
  patient: {
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  visit: { create: vi.fn() },
  recallCycle: { create: vi.fn(), update: vi.fn() },
  callLog: { create: vi.fn() },
  $transaction: vi.fn(async (cb) => cb(prismaMock)),
};
vi.mock('../src/lib/prisma.js', () => ({ default: prismaMock }));

const { makeTestApp } = await import('./helpers.js');

// Returns a supertest agent with an authenticated session.
async function authedAgent() {
  prismaMock.user.findUnique.mockResolvedValue({
    id: 1,
    username: 'staff',
    passwordHash: await bcrypt.hash('pw', 10),
    role: 'STAFF',
    displayName: 'Staff',
  });
  const agent = request.agent(makeTestApp());
  await agent.post('/api/auth/login').send({ username: 'staff', password: 'pw' });
  return agent;
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
});

describe('patients auth', () => {
  it('401 when unauthenticated', async () => {
    const res = await request(makeTestApp()).get('/api/patients');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/patients', () => {
  it('searches by name/phone when q is given', async () => {
    prismaMock.patient.findMany.mockResolvedValue([]);
    const agent = await authedAgent();
    await agent.get('/api/patients?q=王');

    const arg = prismaMock.patient.findMany.mock.calls.at(-1)[0];
    expect(arg.where.OR).toEqual([
      { name: { contains: '王', mode: 'insensitive' } },
      { phone: { contains: '王' } },
    ]);
  });

  it('serializes dates and active recall date', async () => {
    prismaMock.patient.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Wang',
        phone: '0912',
        birthday: new Date('1990-05-01T00:00:00Z'),
        lastVisit: new Date('2026-01-15T00:00:00Z'),
        intervalMonths: 6,
        status: 'ACTIVE',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        recallCycles: [{ isActive: true, recallDate: new Date('2026-07-15T00:00:00Z') }],
      },
    ]);
    const agent = await authedAgent();
    const res = await agent.get('/api/patients');
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({
      name: 'Wang',
      birthday: '1990-05-01',
      lastVisit: '2026-01-15',
      recallDate: '2026-07-15',
    });
  });
});

describe('POST /api/patients', () => {
  it('400 when name is missing', async () => {
    const agent = await authedAgent();
    const res = await agent.post('/api/patients').send({ phone: '0912' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('NAME_REQUIRED');
  });

  it('400 on invalid interval', async () => {
    const agent = await authedAgent();
    const res = await agent.post('/api/patients').send({ name: 'X', intervalMonths: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_INTERVAL');
  });

  it('seeds a visit + recall cycle with computed recall date', async () => {
    prismaMock.patient.create.mockResolvedValue({ id: 9 });
    prismaMock.visit.create.mockResolvedValue({});
    prismaMock.recallCycle.create.mockResolvedValue({});
    prismaMock.patient.findUnique.mockResolvedValue({
      id: 9,
      name: 'Wang',
      phone: null,
      birthday: null,
      lastVisit: new Date('2026-01-15T00:00:00Z'),
      intervalMonths: 6,
      status: 'ACTIVE',
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      recallCycles: [{ isActive: true, recallDate: new Date('2026-07-15T00:00:00Z') }],
    });

    const agent = await authedAgent();
    const res = await agent
      .post('/api/patients')
      .send({ name: 'Wang', lastVisit: '2026-01-15', intervalMonths: 6 });

    expect(res.status).toBe(201);
    expect(res.body.recallDate).toBe('2026-07-15');
    expect(prismaMock.visit.create).toHaveBeenCalledOnce();
    const cycleArg = prismaMock.recallCycle.create.mock.calls.at(-1)[0];
    expect(cycleArg.data.recallDate.toISOString()).toBe('2026-07-15T00:00:00.000Z');
  });

  it('does not create a cycle when no last visit', async () => {
    prismaMock.patient.create.mockResolvedValue({ id: 10 });
    prismaMock.patient.findUnique.mockResolvedValue({
      id: 10,
      name: 'NoVisit',
      intervalMonths: 6,
      status: 'ACTIVE',
      recallCycles: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const agent = await authedAgent();
    const res = await agent.post('/api/patients').send({ name: 'NoVisit' });
    expect(res.status).toBe(201);
    expect(prismaMock.recallCycle.create).not.toHaveBeenCalled();
    expect(res.body.recallDate).toBeNull();
  });
});

describe('PATCH /api/patients/:id', () => {
  it('seeds tracking when a lastVisit is added to a patient with no active cycle', async () => {
    prismaMock.patient.findUnique
      .mockResolvedValueOnce({ id: 5, lastVisit: null, intervalMonths: 6, recallCycles: [] }) // existing
      .mockResolvedValueOnce({
        id: 5,
        name: 'Late',
        intervalMonths: 6,
        status: 'ACTIVE',
        lastVisit: new Date('2026-01-15T00:00:00Z'),
        recallCycles: [{ isActive: true, recallDate: new Date('2026-07-15T00:00:00Z') }],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    prismaMock.patient.update.mockResolvedValue({});
    prismaMock.visit.create.mockResolvedValue({});
    prismaMock.recallCycle.create.mockResolvedValue({});

    const agent = await authedAgent();
    const res = await agent.patch('/api/patients/5').send({ lastVisit: '2026-01-15' });

    expect(res.status).toBe(200);
    expect(prismaMock.recallCycle.create).toHaveBeenCalledOnce();
    expect(res.body.recallDate).toBe('2026-07-15');
  });

  it('retires an untouched cycle when lastVisit is cleared', async () => {
    prismaMock.patient.findUnique
      .mockResolvedValueOnce({
        id: 6,
        lastVisit: new Date('2026-01-15T00:00:00Z'),
        intervalMonths: 6,
        recallCycles: [{ id: 77, isActive: true, step: 'NOT_STARTED' }],
      })
      .mockResolvedValueOnce({
        id: 6,
        name: 'Cleared',
        intervalMonths: 6,
        status: 'ACTIVE',
        lastVisit: null,
        recallCycles: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    prismaMock.patient.update.mockResolvedValue({});
    prismaMock.recallCycle.update.mockResolvedValue({});

    const agent = await authedAgent();
    const res = await agent.patch('/api/patients/6').send({ lastVisit: null });

    expect(res.status).toBe(200);
    const updateArg = prismaMock.recallCycle.update.mock.calls.at(-1)[0];
    expect(updateArg).toMatchObject({ where: { id: 77 }, data: { isActive: false } });
    expect(res.body.recallDate).toBeNull();
  });
});

describe('GET /api/patients/:id', () => {
  it('404 when not found', async () => {
    prismaMock.patient.findUnique.mockResolvedValue(null);
    const agent = await authedAgent();
    const res = await agent.get('/api/patients/999');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/patients/:id/reschedule', () => {
  it('closes the active cycle and opens a new one anchored on the visit', async () => {
    prismaMock.patient.findUnique
      .mockResolvedValueOnce({
        id: 3,
        intervalMonths: 6,
        recallCycles: [{ id: 50, isActive: true }],
      })
      .mockResolvedValueOnce({
        id: 3,
        name: 'Booked',
        intervalMonths: 6,
        status: 'ACTIVE',
        lastVisit: new Date('2026-06-20T00:00:00Z'),
        recallCycles: [{ isActive: true, recallDate: new Date('2026-12-20T00:00:00Z') }],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    prismaMock.recallCycle.update.mockResolvedValue({});
    prismaMock.patient.update.mockResolvedValue({});
    prismaMock.visit.create.mockResolvedValue({});
    prismaMock.recallCycle.create.mockResolvedValue({});

    const agent = await authedAgent();
    const res = await agent.post('/api/patients/3/reschedule').send({ visitDate: '2026-06-20' });

    expect(res.status).toBe(201);
    expect(prismaMock.recallCycle.update.mock.calls.at(-1)[0]).toMatchObject({
      where: { id: 50 },
      data: { isActive: false, closedReason: 'CONFIRMED_BOOKED' },
    });
    expect(prismaMock.visit.create).toHaveBeenCalledOnce();
    expect(prismaMock.recallCycle.create.mock.calls.at(-1)[0].data.recallDate.toISOString()).toBe(
      '2026-12-20T00:00:00.000Z'
    );
    expect(res.body.recallDate).toBe('2026-12-20');
  });

  it('400 when visitDate is missing', async () => {
    const agent = await authedAgent();
    const res = await agent.post('/api/patients/3/reschedule').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VISIT_DATE_REQUIRED');
  });

  it('404 when the patient is missing', async () => {
    prismaMock.patient.findUnique.mockResolvedValue(null);
    const agent = await authedAgent();
    const res = await agent.post('/api/patients/999/reschedule').send({ visitDate: '2026-06-20' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/patients/:id', () => {
  it('204 on success', async () => {
    prismaMock.patient.delete.mockResolvedValue({});
    const agent = await authedAgent();
    const res = await agent.delete('/api/patients/1');
    expect(res.status).toBe(204);
  });

  it('404 when the record is missing (P2025)', async () => {
    prismaMock.patient.delete.mockRejectedValue({ code: 'P2025' });
    const agent = await authedAgent();
    const res = await agent.delete('/api/patients/1');
    expect(res.status).toBe(404);
  });
});
