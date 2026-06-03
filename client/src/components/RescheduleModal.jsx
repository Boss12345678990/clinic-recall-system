import { useState } from 'react';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Modal to book the next visit and open a fresh recall cycle (spec §8 confirm flow).
export default function RescheduleModal({ patientName, defaultInterval = 6, onSubmit, onClose }) {
  const [visitDate, setVisitDate] = useState(todayStr());
  const [intervalMonths, setIntervalMonths] = useState(defaultInterval);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onSubmit({ visitDate, intervalMonths: Number(intervalMonths) });
    } catch {
      setError('安排失敗，請重試');
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg"
      >
        <h2 className="mb-1 text-lg font-semibold text-slate-800">安排下次看診</h2>
        <p className="mb-4 text-sm text-slate-500">{patientName}：確認複診並開新一輪回診。</p>

        <label htmlFor="visitDate" className="mb-1 block text-sm font-medium text-slate-600">
          下次看診日
        </label>
        <input
          id="visitDate"
          type="date"
          value={visitDate}
          onChange={(e) => setVisitDate(e.target.value)}
          className="input mb-4"
          required
        />

        <label htmlFor="rsInterval" className="mb-1 block text-sm font-medium text-slate-600">
          回診間隔（月）
        </label>
        <input
          id="rsInterval"
          type="number"
          min="1"
          value={intervalMonths}
          onChange={(e) => setIntervalMonths(e.target.value)}
          className="input mb-4"
        />

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? '處理中…' : '確認並安排'}
          </button>
        </div>
      </form>
    </div>
  );
}
