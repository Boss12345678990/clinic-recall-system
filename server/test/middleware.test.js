import { describe, it, expect, vi } from 'vitest';

const findUnique = vi.fn();
vi.mock('../src/lib/prisma.js', () => ({ default: { user: { findUnique: (...a) => findUnique(...a) } } }));

const { requireAuth, requireRole } = await import('../src/middleware/auth.js');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('requireAuth', () => {
  it('401 without session userId', () => {
    const res = mockRes();
    const next = vi.fn();
    requireAuth({ session: {} }, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when authenticated', () => {
    const res = mockRes();
    const next = vi.fn();
    requireAuth({ session: { userId: 1 } }, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('requireRole', () => {
  it('403 when the DB role does not match (even if the session says otherwise)', async () => {
    findUnique.mockResolvedValue({ role: 'STAFF' });
    const res = mockRes();
    const next = vi.fn();
    await requireRole('ADMIN')({ session: { userId: 1, role: 'ADMIN' } }, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when the current DB role matches', async () => {
    findUnique.mockResolvedValue({ role: 'ADMIN' });
    const res = mockRes();
    const next = vi.fn();
    await requireRole('ADMIN')({ session: { userId: 1, role: 'STAFF' } }, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('401 when the user no longer exists', async () => {
    findUnique.mockResolvedValue(null);
    const res = mockRes();
    res.destroySession = vi.fn();
    const next = vi.fn();
    await requireRole('ADMIN')(
      { session: { userId: 9, destroy: (cb) => cb() } },
      res,
      next
    );
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});
