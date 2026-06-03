import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';

const prismaMock = {
  user: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  setting: { findMany: vi.fn(), upsert: vi.fn() },
  $transaction: vi.fn(async (arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(prismaMock))),
};
vi.mock('../src/lib/prisma.js', () => ({ default: prismaMock }));

const { makeTestApp } = await import('./helpers.js');

async function authedAgent(role) {
  prismaMock.user.findUnique.mockResolvedValue({
    id: 1,
    username: 'u',
    passwordHash: await bcrypt.hash('pw', 10),
    role,
  });
  const agent = request.agent(makeTestApp());
  await agent.post('/api/auth/login').send({ username: 'u', password: 'pw' });
  return agent;
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.setting.findMany.mockResolvedValue([]);
  prismaMock.setting.upsert.mockResolvedValue({});
  prismaMock.$transaction.mockImplementation(async (arg) =>
    Array.isArray(arg) ? Promise.all(arg) : arg(prismaMock)
  );
});

describe('settings', () => {
  it('GET returns effective settings (defaults)', async () => {
    const agent = await authedAgent('STAFF');
    const res = await agent.get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body.clinicName).toBe('牙醫診所');
    expect(res.body.lineLeadDays).toBe(7);
  });

  it('PUT is forbidden for STAFF', async () => {
    const agent = await authedAgent('STAFF');
    const res = await agent.put('/api/settings').send({ lineLeadDays: 5 });
    expect(res.status).toBe(403);
  });

  it('PUT updates as ADMIN', async () => {
    const agent = await authedAgent('ADMIN');
    const res = await agent.put('/api/settings').send({ lineLeadDays: 5, clinicName: '微笑' });
    expect(res.status).toBe(200);
    expect(prismaMock.setting.upsert).toHaveBeenCalledTimes(2);
  });

  it('PUT rejects an invalid numeric setting', async () => {
    const agent = await authedAgent('ADMIN');
    const res = await agent.put('/api/settings').send({ lineLeadDays: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_SETTING');
  });

  it('PUT rejects maxCalls above the CALL_3 limit', async () => {
    const agent = await authedAgent('ADMIN');
    const res = await agent.put('/api/settings').send({ maxCalls: 4 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_SETTING');
  });
});

describe('users', () => {
  it('is forbidden for STAFF', async () => {
    const agent = await authedAgent('STAFF');
    expect((await agent.get('/api/users')).status).toBe(403);
  });

  it('lists users for ADMIN', async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: 1, username: 'admin', role: 'ADMIN' }]);
    const agent = await authedAgent('ADMIN');
    const res = await agent.get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('rejects a blank (whitespace) username', async () => {
    const agent = await authedAgent('ADMIN');
    const res = await agent.post('/api/users').send({ username: '   ', password: 'secret1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('USERNAME_REQUIRED');
  });

  it('rejects a weak password', async () => {
    const agent = await authedAgent('ADMIN');
    const res = await agent.post('/api/users').send({ username: 'x', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('WEAK_PASSWORD');
  });

  it('creates a user', async () => {
    prismaMock.user.create.mockResolvedValue({ id: 2, username: 'staff1', role: 'STAFF' });
    const agent = await authedAgent('ADMIN');
    const res = await agent.post('/api/users').send({ username: 'staff1', password: 'secret1', role: 'STAFF' });
    expect(res.status).toBe(201);
    const created = prismaMock.user.create.mock.calls.at(-1)[0].data;
    expect(created.passwordHash).toBeTruthy();
    expect(created.passwordHash).not.toBe('secret1'); // hashed, not plaintext
  });

  it('409 on a duplicate username', async () => {
    prismaMock.user.create.mockRejectedValue({ code: 'P2002' });
    const agent = await authedAgent('ADMIN');
    const res = await agent.post('/api/users').send({ username: 'dupe', password: 'secret1' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('USERNAME_TAKEN');
  });

  it('400 on an invalid role update', async () => {
    const agent = await authedAgent('ADMIN');
    const res = await agent.patch('/api/users/2').send({ role: 'BOSS' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('INVALID_ROLE');
  });
});
