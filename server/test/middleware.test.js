import { describe, it, expect, vi } from 'vitest';
import { requireAuth, requireRole } from '../src/middleware/auth.js';

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
  it('403 when role mismatch', () => {
    const res = mockRes();
    const next = vi.fn();
    requireRole('ADMIN')({ session: { userId: 1, role: 'STAFF' } }, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when role matches', () => {
    const res = mockRes();
    const next = vi.fn();
    requireRole('ADMIN')({ session: { userId: 1, role: 'ADMIN' } }, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
