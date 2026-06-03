import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { recallsApi } from '../api/recalls.js';
import { cyclesApi } from '../api/cycles.js';

const BUCKETS = [
  { key: 'needLine', title: '要傳 LINE', accent: 'border-green-400', dot: 'bg-green-500' },
  { key: 'needCall', title: '要打電話', accent: 'border-blue-400', dot: 'bg-blue-500' },
  { key: 'confirmed', title: '已確認複診', accent: 'border-emerald-400', dot: 'bg-emerald-500' },
  { key: 'unreachable', title: '未聯絡上', accent: 'border-red-400', dot: 'bg-red-500' },
];

export default function TodayPage() {
  const [groups, setGroups] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    return recallsApi
      .today()
      .then(setGroups)
      .catch(() => setError('載入今日待辦失敗'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runAction(cycleId, action) {
    setBusyId(cycleId);
    setError('');
    try {
      await action();
      await load();
    } catch {
      setError('操作失敗，請重試');
    } finally {
      setBusyId(null);
    }
  }

  if (loading && !groups) return <div className="text-slate-500">載入中…</div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">今日待辦</h1>
        <button onClick={load} className="text-sm text-blue-600 hover:underline">
          重新整理
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {BUCKETS.map((b) => {
          const items = groups?.[b.key] ?? [];
          return (
            <section key={b.key} className={`rounded-xl border-t-4 bg-white p-4 shadow-sm ${b.accent}`}>
              <h2 className="mb-3 flex items-center gap-2 font-medium text-slate-700">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${b.dot}`} />
                {b.title}
                <span className="ml-auto text-sm text-slate-400">{items.length}</span>
              </h2>

              {items.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-300">（無）</p>
              ) : (
                <ul className="space-y-2">
                  {items.map((item) => (
                    <RecallCard
                      key={item.cycleId}
                      item={item}
                      bucket={b.key}
                      busy={busyId === item.cycleId}
                      onSendLine={() => runAction(item.cycleId, () => cyclesApi.sendLine(item.cycleId))}
                      onRecordCall={() =>
                        runAction(item.cycleId, () => cyclesApi.recordCall(item.cycleId))
                      }
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function RecallCard({ item, bucket, busy, onSendLine, onRecordCall }) {
  return (
    <li className="rounded-lg border border-slate-100 p-3">
      <div className="flex items-baseline justify-between">
        <Link to={`/patients/${item.patientId}`} className="font-medium text-slate-800 hover:underline">
          {item.patientName}
        </Link>
        <OverdueBadge days={item.overdueDays} />
      </div>
      <div className="mt-0.5 text-xs text-slate-500">
        回診日 {item.recallDate}
        {item.phone ? (
          <>
            {' · '}
            <a href={`tel:${item.phone}`} className="text-blue-600 hover:underline">
              {item.phone}
            </a>
          </>
        ) : null}
      </div>

      {bucket === 'needLine' && (
        <button
          onClick={onSendLine}
          disabled={busy}
          className="mt-2 w-full rounded-md bg-green-600 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
        >
          {busy ? '處理中…' : '傳 LINE / 訊息'}
        </button>
      )}

      {bucket === 'needCall' && (
        <button
          onClick={onRecordCall}
          disabled={busy}
          className="mt-2 w-full rounded-md bg-blue-600 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {busy ? '處理中…' : `撥打 / 記錄第 ${item.nextCall} 通`}
        </button>
      )}

      {bucket === 'confirmed' && (
        <p className="mt-2 text-xs text-emerald-600">待安排下次看診</p>
      )}
      {bucket === 'unreachable' && (
        <p className="mt-2 text-xs text-red-500">已撥滿，未聯絡上</p>
      )}
    </li>
  );
}

function OverdueBadge({ days }) {
  if (days == null) return null;
  if (days <= 0) return <span className="text-xs text-slate-400">今天</span>;
  return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">逾期 {days} 天</span>;
}
