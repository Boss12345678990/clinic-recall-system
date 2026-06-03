import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { patientsApi } from '../api/patients.js';

const STEP_LABELS = {
  NOT_STARTED: '尚未開始',
  LINE_SENT: '已傳 LINE',
  CALL_1: '已撥打 1 通',
  CALL_2: '已撥打 2 通',
  CALL_3: '已撥打 3 通',
};
const STATUS_LABELS = { UNCONFIRMED: '未確認', CONFIRMED: '已確認複診' };

export default function PatientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    patientsApi
      .get(id)
      .then((p) => {
        if (!cancelled) setPatient(p);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.status === 404 ? '找不到此病患' : '載入失敗');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleDelete() {
    if (!window.confirm(`確定要刪除「${patient.name}」嗎？此動作無法復原。`)) return;
    try {
      await patientsApi.remove(id);
      navigate('/patients');
    } catch {
      setError('刪除失敗');
    }
  }

  if (loading) return <div className="text-slate-500">載入中…</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!patient) return null;

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-800">{patient.name}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/patients/${id}/edit`)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            編輯
          </button>
          <button
            onClick={handleDelete}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
          >
            刪除
          </button>
        </div>
      </div>

      <section className="mb-4 grid grid-cols-2 gap-y-2 rounded-xl bg-white p-5 text-sm shadow-sm">
        <Info label="電話" value={patient.phone} />
        <Info label="生日" value={patient.birthday} />
        <Info label="最近看診日" value={patient.lastVisit} />
        <Info label="回診間隔" value={`${patient.intervalMonths} 個月`} />
        <Info label="下次回診日" value={patient.recallDate} />
        <Info label="狀態" value={patient.status === 'ACTIVE' ? '追蹤中' : '已封存'} />
        {patient.notes && (
          <div className="col-span-2 mt-1">
            <span className="text-slate-400">備註：</span>
            <span className="text-slate-700">{patient.notes}</span>
          </div>
        )}
      </section>

      <section className="mb-4 rounded-xl bg-white p-5 text-sm shadow-sm">
        <h2 className="mb-2 font-medium text-slate-700">目前回診進度</h2>
        {patient.activeCycle ? (
          <div className="flex gap-6 text-slate-600">
            <span>回診日：{patient.activeCycle.recallDate}</span>
            <span>進度：{STEP_LABELS[patient.activeCycle.step] ?? patient.activeCycle.step}</span>
            <span>狀態：{STATUS_LABELS[patient.activeCycle.status] ?? patient.activeCycle.status}</span>
          </div>
        ) : (
          <p className="text-slate-400">尚無進行中的回診（請設定最近看診日）。</p>
        )}
      </section>

      <section className="rounded-xl bg-white p-5 text-sm shadow-sm">
        <h2 className="mb-2 font-medium text-slate-700">看診紀錄</h2>
        {patient.visits?.length ? (
          <ul className="space-y-1 text-slate-600">
            {patient.visits.map((v) => (
              <li key={v.id}>
                {v.visitDate}
                {v.note ? ` — ${v.note}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-400">尚無看診紀錄。</p>
        )}
      </section>

      <Link to="/patients" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
        ← 返回病患列表
      </Link>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <span className="text-slate-400">{label}：</span>
      <span className="text-slate-700">{value || '—'}</span>
    </div>
  );
}
