import { useEffect, useState } from 'react';
import { settingsApi } from '../api/dashboard.js';

const FIELDS = [
  { key: 'clinicName', label: '診所名稱', type: 'text' },
  { key: 'defaultInterval', label: '預設回診間隔（月）', type: 'number' },
  { key: 'lineLeadDays', label: '回診日前幾天傳 LINE', type: 'number' },
  { key: 'firstCallDelayDays', label: '傳 LINE 後幾天未確認才打電話', type: 'number' },
  { key: 'callGapDays', label: '兩通電話間隔天數', type: 'number' },
  { key: 'maxCalls', label: '最多撥打次數', type: 'number' },
  { key: 'lineTemplate', label: 'LINE 提醒範本', type: 'textarea' },
];

export default function SettingsPage() {
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi.get().then(setForm).catch(() => setError('載入設定失敗'));
  }, []);

  function update(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const updated = await settingsApi.update(form);
      setForm(updated);
      setSaved(true);
    } catch {
      setError('儲存失敗（數值需為正整數）');
    } finally {
      setSaving(false);
    }
  }

  if (error && !form) return <div className="text-red-600">{error}</div>;
  if (!form) return <div className="text-slate-500">載入中…</div>;

  return (
    <div className="max-w-lg">
      <h1 className="mb-4 text-xl font-semibold text-slate-800">設定</h1>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-white p-6 shadow-sm">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label htmlFor={f.key} className="mb-1 block text-sm font-medium text-slate-600">
              {f.label}
            </label>
            {f.type === 'textarea' ? (
              <textarea
                id={f.key}
                rows={3}
                value={form[f.key] ?? ''}
                onChange={(e) => update(f.key, e.target.value)}
                className="input"
              />
            ) : (
              <input
                id={f.key}
                type={f.type}
                min={f.type === 'number' ? 1 : undefined}
                value={form[f.key] ?? ''}
                onChange={(e) => update(f.key, e.target.value)}
                className="input"
              />
            )}
          </div>
        ))}

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-600">已儲存。</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? '儲存中…' : '儲存設定'}
        </button>
      </form>
    </div>
  );
}
