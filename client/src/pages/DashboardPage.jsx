import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../api/dashboard.js';

const CARDS = [
  { key: 'needLine', label: '要傳 LINE', color: 'text-green-600' },
  { key: 'needCall', label: '要打電話', color: 'text-blue-600' },
  { key: 'confirmed', label: '已確認複診', color: 'text-emerald-600' },
  { key: 'unreachable', label: '未聯絡上', color: 'text-red-600' },
];

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    dashboardApi.get().then(setData).catch(() => setError('載入儀表板失敗'));
  }, []);

  if (error) return <div className="text-red-600">{error}</div>;
  if (!data) return <div className="text-slate-500">載入中…</div>;

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-slate-800">儀表板</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {CARDS.map((c) => (
          <Link
            key={c.key}
            to="/"
            className="rounded-xl bg-white p-5 shadow-sm transition hover:shadow"
          >
            <div className={`text-3xl font-bold ${c.color}`}>{data.counts[c.key]}</div>
            <div className="mt-1 text-sm text-slate-500">{c.label}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-2 font-medium text-slate-700">追蹤中病患</h2>
          <p className="text-3xl font-bold text-slate-800">{data.totalActive}</p>
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-2 font-medium text-slate-700">近期生日（7 天內）</h2>
          {data.birthdays.length === 0 ? (
            <p className="text-sm text-slate-400">近期無生日。</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {data.birthdays.map((b) => (
                <li key={b.id} className="flex justify-between">
                  <Link to={`/patients/${b.id}`} className="text-slate-700 hover:underline">
                    {b.name}
                  </Link>
                  <span className="text-slate-400">
                    {b.birthday?.slice(5)}
                    {b.daysUntil === 0 ? '（今天 🎂）' : `（${b.daysUntil} 天後）`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
