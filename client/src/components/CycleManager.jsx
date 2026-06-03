import { useState } from 'react';
import { cyclesApi } from '../api/cycles.js';
import { patientsApi } from '../api/patients.js';
import RescheduleModal from './RescheduleModal.jsx';

// Displayed stepper steps (NOT_STARTED is the implicit "before" state).
const STEPS = [
  { key: 'LINE_SENT', label: '傳 LINE' },
  { key: 'CALL_1', label: '電話 1' },
  { key: 'CALL_2', label: '電話 2' },
  { key: 'CALL_3', label: '電話 3' },
];
const ORDER = { NOT_STARTED: -1, LINE_SENT: 0, CALL_1: 1, CALL_2: 2, CALL_3: 3 };

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : null;
}

// Per-step date: LINE from lineSentAt, calls from their CallLog.
function stepDate(cycle, stepKey) {
  if (stepKey === 'LINE_SENT') return dateOnly(cycle.lineSentAt);
  const attemptNo = ORDER[stepKey]; // CALL_1->1, CALL_2->2, CALL_3->3
  const log = cycle.callLogs?.find((l) => l.attemptNo === attemptNo);
  return log ? dateOnly(log.calledAt) : null;
}

export default function CycleManager({ cycle, patient, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showReschedule, setShowReschedule] = useState(false);

  const current = ORDER[cycle.step] ?? -1;
  const confirmed = cycle.status === 'CONFIRMED';

  async function run(action) {
    setBusy(true);
    setError('');
    try {
      await action();
      await onChanged();
    } catch {
      setError('操作失敗，請重試');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* Clickable stepper */}
      <div className="mb-4 flex items-center">
        {STEPS.map((s, i) => {
          const done = current >= i;
          return (
            <div key={s.key} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                {i > 0 && <div className={`h-0.5 flex-1 ${current >= i ? 'bg-blue-500' : 'bg-slate-200'}`} />}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => cyclesApi.setStep(cycle.id, s.key))}
                  title="點擊設定進度"
                  className={`grid h-8 w-8 place-items-center rounded-full text-xs font-medium disabled:opacity-60 ${
                    done ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
                  } ${current === i ? 'ring-2 ring-blue-300' : ''}`}
                >
                  {i + 1}
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 ${current > i ? 'bg-blue-500' : 'bg-slate-200'}`} />
                )}
              </div>
              <span className="mt-1 text-xs text-slate-600">{s.label}</span>
              <span className="text-[10px] text-slate-400">{stepDate(cycle, s.key) ?? '·'}</span>
            </div>
          );
        })}
      </div>

      {/* Status + actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => cyclesApi.setStatus(cycle.id, confirmed ? 'UNCONFIRMED' : 'CONFIRMED'))}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${
            confirmed ? 'bg-emerald-100 text-emerald-700' : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
          }`}
        >
          {confirmed ? '✓ 已確認複診' : '標記確認複診'}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => setShowReschedule(true)}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          安排下次看診
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => cyclesApi.close(cycle.id, 'NO_RESPONSE'))}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          標記未聯絡上
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {showReschedule && (
        <RescheduleModal
          patientName={patient.name}
          defaultInterval={patient.intervalMonths}
          onClose={() => setShowReschedule(false)}
          onSubmit={async ({ visitDate, intervalMonths }) => {
            await patientsApi.reschedule(patient.id, { visitDate, intervalMonths });
            setShowReschedule(false);
            await onChanged();
          }}
        />
      )}
    </div>
  );
}
