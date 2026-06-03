import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';

const prismaMock = {
  user: { findUnique: vi.fn() },
  setting: { findMany: vi.fn() },
  recallCycle: { findUnique: vi.fn(), update: vi.fn() },
  callLog: { create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  $transaction: vi.fn(async (cb) => cb(prismaMock)),
};
vi.mock('../src/lib/prisma.js', () => ({ default: prismaMock }));

const { makeTestApp } = await import('./helpers.js');

async function authedAgent() {
  prismaMock.user.findUnique.mockResolvedValue({
    id: 1,
    username: 'staff',
    passwordHash: await bcrypt.hash('pw', 10),
    role: 'STAFF',
  });
  const agent = request.agent(makeTestApp());
  await agent.post('/api/auth/login').send({ username: 'staff', password: 'pw' });
  return agent;
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
  prismaMock.setting.findMany.mockResolvedValue([]); // default settings (maxCalls 3)
});

describe('POST /api/cycles/:id/line', () => {
  it('marks LINE sent from NOT_STARTED', async () => {
    prismaMock.recallCycle.findUnique.mockResolvedValue({
      id: 1,
      isActive: true,
      step: 'NOT_STARTED',
      callLogs: [],
    });
    prismaMock.recallCycle.update.mockResolvedValue({ id: 1, step: 'LINE_SENT', recallDate: null });

    const agent = await authedAgent();
    const res = await agent.post('/api/cycles/1/line');
    expect(res.status).toBe(200);
    const arg = prismaMock.recallCycle.update.mock.calls.at(-1)[0];
    expect(arg.data.step).toBe('LINE_SENT');
    expect(arg.data.lineSentAt).toBeInstanceOf(Date);
  });

  it('404 when the cycle is missing', async () => {
    prismaMock.recallCycle.findUnique.mockResolvedValue(null);
    const agent = await authedAgent();
    expect((await agent.post('/api/cycles/1/line')).status).toBe(404);
  });

  it('400 when the cycle is closed', async () => {
    prismaMock.recallCycle.findUnique.mockResolvedValue({ id: 1, isActive: false, step: 'NOT_STARTED' });
    const agent = await authedAgent();
    const res = await agent.post('/api/cycles/1/line');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('CYCLE_CLOSED');
  });

  it('400 INVALID_STEP when LINE was already sent', async () => {
    prismaMock.recallCycle.findUnique.mockResolvedValue({
      id: 1,
      isActive: true,
      step: 'LINE_SENT',
      callLogs: [],
    });
    const agent = await authedAgent();
    const res = await agent.post('/api/cycles/1/line');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_STEP');
  });
});

describe('POST /api/cycles/:id/calls', () => {
  it('records the first call and advances to CALL_1', async () => {
    prismaMock.recallCycle.findUnique.mockResolvedValue({
      id: 1,
      patientId: 5,
      isActive: true,
      step: 'LINE_SENT',
      callLogs: [],
    });
    prismaMock.callLog.create.mockResolvedValue({});
    prismaMock.recallCycle.update.mockResolvedValue({ id: 1, step: 'CALL_1', recallDate: null });

    const agent = await authedAgent();
    const res = await agent.post('/api/cycles/1/calls').send({ note: 'no answer' });
    expect(res.status).toBe(201);
    expect(prismaMock.callLog.create.mock.calls.at(-1)[0].data).toMatchObject({
      attemptNo: 1,
      patientId: 5,
      outcome: 'NO_ANSWER',
    });
    expect(prismaMock.recallCycle.update.mock.calls.at(-1)[0].data.step).toBe('CALL_1');
  });

  it('400 INVALID_STEP when calling before LINE is sent', async () => {
    prismaMock.recallCycle.findUnique.mockResolvedValue({
      id: 1,
      patientId: 5,
      isActive: true,
      step: 'NOT_STARTED',
      callLogs: [],
    });
    const agent = await authedAgent();
    const res = await agent.post('/api/cycles/1/calls').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_STEP');
    expect(prismaMock.callLog.create).not.toHaveBeenCalled();
  });

  it('400 MAX_CALLS_REACHED at the configured limit', async () => {
    // maxCalls = 2 via settings; cycle already made 2 calls.
    prismaMock.setting.findMany.mockResolvedValue([{ key: 'maxCalls', value: '2' }]);
    prismaMock.recallCycle.findUnique.mockResolvedValue({
      id: 1,
      patientId: 5,
      isActive: true,
      step: 'CALL_2',
      callLogs: [{ attemptNo: 1 }, { attemptNo: 2 }],
    });
    const agent = await authedAgent();
    const res = await agent.post('/api/cycles/1/calls').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MAX_CALLS_REACHED');
    expect(prismaMock.callLog.create).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/cycles/:id/step', () => {
  it('sets LINE_SENT with a backdated lineSentAt', async () => {
    prismaMock.recallCycle.findUnique.mockResolvedValue({
      id: 1,
      patientId: 5,
      isActive: true,
      step: 'NOT_STARTED',
      lineSentAt: null,
      callLogs: [],
    });
    prismaMock.recallCycle.update.mockResolvedValue({ id: 1, step: 'LINE_SENT', recallDate: null });

    const agent = await authedAgent();
    const res = await agent.patch('/api/cycles/1/step').send({ step: 'LINE_SENT', date: '2026-05-01' });
    expect(res.status).toBe(200);
    const data = prismaMock.recallCycle.update.mock.calls.at(-1)[0].data;
    expect(data.step).toBe('LINE_SENT');
    expect(data.lineSentAt.toISOString()).toBe('2026-05-01T00:00:00.000Z');
  });

  it('records a backdated CallLog when moving to a CALL step', async () => {
    prismaMock.recallCycle.findUnique.mockResolvedValue({
      id: 1,
      patientId: 5,
      isActive: true,
      step: 'LINE_SENT',
      lineSentAt: new Date(),
      callLogs: [],
    });
    prismaMock.callLog.create.mockResolvedValue({});
    prismaMock.recallCycle.update.mockResolvedValue({ id: 1, step: 'CALL_1', recallDate: null });

    const agent = await authedAgent();
    const res = await agent.patch('/api/cycles/1/step').send({ step: 'CALL_1', date: '2026-05-04' });
    expect(res.status).toBe(200);
    expect(prismaMock.callLog.create.mock.calls.at(-1)[0].data).toMatchObject({ attemptNo: 1 });
  });

  it('drops later call attempts when rewinding the step', async () => {
    prismaMock.recallCycle.findUnique.mockResolvedValue({
      id: 1,
      patientId: 5,
      isActive: true,
      step: 'CALL_2',
      callLogs: [{ id: 11, attemptNo: 1 }, { id: 12, attemptNo: 2 }],
    });
    prismaMock.recallCycle.update.mockResolvedValue({ id: 1, step: 'CALL_1', recallDate: null });

    const agent = await authedAgent();
    const res = await agent.patch('/api/cycles/1/step').send({ step: 'CALL_1' });
    expect(res.status).toBe(200);
    expect(prismaMock.callLog.deleteMany.mock.calls.at(-1)[0]).toMatchObject({
      where: { cycleId: 1, attemptNo: { gt: 1 } },
    });
  });

  it('400 on an invalid step', async () => {
    const agent = await authedAgent();
    const res = await agent.patch('/api/cycles/1/step').send({ step: 'BOGUS' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_STEP');
  });
});

describe('PATCH /api/cycles/:id/status', () => {
  it('confirms a cycle', async () => {
    prismaMock.recallCycle.findUnique.mockResolvedValue({ id: 1, isActive: true, callLogs: [] });
    prismaMock.recallCycle.update.mockResolvedValue({ id: 1, status: 'CONFIRMED', recallDate: null });
    const agent = await authedAgent();
    const res = await agent.patch('/api/cycles/1/status').send({ status: 'CONFIRMED' });
    expect(res.status).toBe(200);
    expect(prismaMock.recallCycle.update.mock.calls.at(-1)[0].data.status).toBe('CONFIRMED');
  });

  it('400 on an invalid status', async () => {
    const agent = await authedAgent();
    const res = await agent.patch('/api/cycles/1/status').send({ status: 'MAYBE' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_STATUS');
  });
});

describe('POST /api/cycles/:id/close', () => {
  it('closes a cycle as unreachable', async () => {
    prismaMock.recallCycle.findUnique.mockResolvedValue({ id: 1, isActive: true, callLogs: [] });
    prismaMock.recallCycle.update.mockResolvedValue({ id: 1, isActive: false, recallDate: null });
    const agent = await authedAgent();
    const res = await agent.post('/api/cycles/1/close').send({ reason: 'NO_RESPONSE' });
    expect(res.status).toBe(200);
    expect(prismaMock.recallCycle.update.mock.calls.at(-1)[0].data).toMatchObject({
      isActive: false,
      closedReason: 'NO_RESPONSE',
    });
  });

  it('400 on an invalid reason', async () => {
    const agent = await authedAgent();
    const res = await agent.post('/api/cycles/1/close').send({ reason: 'BECAUSE' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_REASON');
  });
});
