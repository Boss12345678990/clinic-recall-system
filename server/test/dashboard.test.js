import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';

const prismaMock = {
  user: { findUnique: vi.fn() },
  setting: { findMany: vi.fn() },
  recallCycle: { findMany: vi.fn() },
  patient: { count: vi.fn(), findMany: vi.fn() },
};
vi.mock('../src/lib/prisma.js', () => ({ default: prismaMock }));

const { makeTestApp } = await import('./helpers.js');

async function authedAgent() {
  prismaMock.user.findUnique.mockResolvedValue({
    id: 1,
    username: 'u',
    passwordHash: await bcrypt.hash('pw', 10),
    role: 'STAFF',
  });
  const agent = request.agent(makeTestApp());
  await agent.post('/api/auth/login').send({ username: 'u', password: 'pw' });
  return agent;
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.setting.findMany.mockResolvedValue([]);
});

describe('GET /api/dashboard', () => {
  it('401 when unauthenticated', async () => {
    expect((await request(makeTestApp()).get('/api/dashboard')).status).toBe(401);
  });

  it('returns bucket counts, total, and birthdays', async () => {
    prismaMock.recallCycle.findMany.mockResolvedValue([]);
    prismaMock.patient.count.mockResolvedValue(12);
    prismaMock.patient.findMany.mockResolvedValue([]);

    const agent = await authedAgent();
    const res = await agent.get('/api/dashboard');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      counts: { needLine: 0, needCall: 0, confirmed: 0, unreachable: 0 },
      totalActive: 12,
      birthdays: [],
    });
  });
});
