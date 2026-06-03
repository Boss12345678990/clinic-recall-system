import { useEffect, useState } from 'react';
import { usersApi } from '../api/dashboard.js';
import { ApiError } from '../api/client.js';

const ROLE_LABELS = { ADMIN: '管理者', STAFF: '櫃檯' };
const ERRORS = {
  USERNAME_REQUIRED: '請輸入帳號',
  WEAK_PASSWORD: '密碼至少 6 碼',
  USERNAME_TAKEN: '帳號已存在',
  INVALID_ROLE: '角色不正確',
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: '', password: '', displayName: '', role: 'STAFF' });
  const [saving, setSaving] = useState(false);

  function load() {
    usersApi.list().then(setUsers).catch(() => setError('載入帳號失敗'));
  }
  useEffect(load, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await usersApi.create(form);
      setForm({ username: '', password: '', displayName: '', role: 'STAFF' });
      load();
    } catch (err) {
      setError(ERRORS[err instanceof ApiError ? err.code : ''] ?? '新增失敗');
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(user, role) {
    try {
      await usersApi.update(user.id, { role });
      load();
    } catch {
      setError('更新角色失敗');
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-xl font-semibold text-slate-800">帳號管理</h1>

      <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">帳號</th>
              <th className="px-4 py-2 font-medium">名稱</th>
              <th className="px-4 py-2 font-medium">角色</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2 font-medium text-slate-800">{u.username}</td>
                <td className="px-4 py-2 text-slate-600">{u.displayName || '—'}</td>
                <td className="px-4 py-2">
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u, e.target.value)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                  >
                    <option value="STAFF">{ROLE_LABELS.STAFF}</option>
                    <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={handleCreate} className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-3 font-medium text-slate-700">新增帳號</h2>
        <div className="grid grid-cols-2 gap-3">
          <input
            className="input"
            placeholder="帳號"
            aria-label="帳號"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <input
            className="input"
            type="password"
            placeholder="密碼（至少 6 碼）"
            aria-label="密碼"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <input
            className="input"
            placeholder="顯示名稱"
            aria-label="顯示名稱"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          />
          <select
            className="input"
            aria-label="角色"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="STAFF">{ROLE_LABELS.STAFF}</option>
            <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
          </select>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? '新增中…' : '新增帳號'}
        </button>
      </form>
    </div>
  );
}
