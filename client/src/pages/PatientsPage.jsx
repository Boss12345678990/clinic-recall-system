import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { patientsApi } from '../api/patients.js';

export default function PatientsPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Debounce search so we don't hit the API on every keystroke.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      patientsApi
        .list(query)
        .then((data) => {
          if (!cancelled) setPatients(data);
        })
        .catch(() => {
          if (!cancelled) setError('載入病患資料失敗');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">病患資料</h1>
        <button
          onClick={() => navigate('/patients/new')}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + 新增病患
        </button>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜尋姓名或電話…"
        aria-label="搜尋姓名或電話"
        className="mb-4 w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">姓名</th>
              <th className="px-4 py-2 font-medium">電話</th>
              <th className="px-4 py-2 font-medium">最近看診</th>
              <th className="px-4 py-2 font-medium">下次回診</th>
              <th className="px-4 py-2 font-medium">狀態</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  載入中…
                </td>
              </tr>
            ) : patients.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  {query ? '查無符合的病患' : '尚無病患資料'}
                </td>
              </tr>
            ) : (
              patients.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/patients/${p.id}`)}
                  className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-2 font-medium text-slate-800">
                    <Link to={`/patients/${p.id}`} onClick={(e) => e.stopPropagation()}>
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{p.phone || '—'}</td>
                  <td className="px-4 py-2 text-slate-600">{p.lastVisit || '—'}</td>
                  <td className="px-4 py-2 text-slate-600">{p.recallDate || '—'}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        p.status === 'ACTIVE'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {p.status === 'ACTIVE' ? '追蹤中' : '已封存'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
