import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { ApiError } from '../api/client.js';

const ERROR_MESSAGES = {
  MISSING_CREDENTIALS: '請輸入帳號與密碼',
  INVALID_CREDENTIALS: '帳號或密碼錯誤',
  TOO_MANY_ATTEMPTS: '嘗試次數過多，請稍後再試',
};

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from ?? '/';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      setError(ERROR_MESSAGES[code] ?? '登入失敗，請稍後再試');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid h-full place-items-center bg-slate-100 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm"
      >
        <h1 className="mb-6 text-center text-xl font-semibold text-slate-800">
          診所回診提醒系統
        </h1>

        <label htmlFor="username" className="mb-1 block text-sm font-medium text-slate-600">
          帳號
        </label>
        <input
          id="username"
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
        />

        <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-600">
          密碼
        </label>
        <input
          id="password"
          type="password"
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-blue-600 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? '登入中…' : '登入'}
        </button>
      </form>
    </div>
  );
}
