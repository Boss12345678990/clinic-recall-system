import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';

// Mock the shared Prisma client so these tests need no database.
const findUnique = vi.fn();
vi.mock('../src/lib/prisma.js', () => ({
  default: { user: { findUnique: (...args) => findUnique(...args) } },
}));

const { makeTestApp } = await import('./helpers.js');

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it('400 when credentials missing', async () => {
    const res = await request(makeTestApp()).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('MISSING_CREDENTIALS');
  });

  it('401 when user not found', async () => {
    findUnique.mockResolvedValue(null);
    const res = await request(makeTestApp())
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'x' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_CREDENTIALS');
  });

  it('401 when password wrong', async () => {
    findUnique.mockResolvedValue({
      id: 1,
      username: 'admin',
      passwordHash: await bcrypt.hash('correct', 12),
      role: 'ADMIN',
      displayName: 'Admin',
    });
    const res = await request(makeTestApp())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_CREDENTIALS');
  });

  it('500 (not a crash) when the auth query rejects', async () => {
    findUnique.mockRejectedValue(new Error('db down'));
    const res = await request(makeTestApp())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'x' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('INTERNAL_ERROR');
  });

  it('200 and sets cookie on success', async () => {
    findUnique.mockResolvedValue({
      id: 7,
      username: 'admin',
      passwordHash: await bcrypt.hash('correct', 12),
      role: 'ADMIN',
      displayName: 'Admin',
    });
    const res = await request(makeTestApp())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'correct' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 7, username: 'admin', role: 'ADMIN' });
    expect(res.body.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie']?.[0]).toMatch(/clinic\.sid/);
  });
});

describe('GET /api/auth/me', () => {
  beforeEach(() => findUnique.mockReset());

  it('401 when not logged in', async () => {
    const res = await request(makeTestApp()).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns the user after login (session persists via agent)', async () => {
    const user = {
      id: 7,
      username: 'admin',
      passwordHash: await bcrypt.hash('correct', 12),
      role: 'ADMIN',
      displayName: 'Admin',
    };
    findUnique.mockResolvedValue(user);

    const agent = request.agent(makeTestApp());
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'correct' });

    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 7, username: 'admin', role: 'ADMIN' });
  });
});
