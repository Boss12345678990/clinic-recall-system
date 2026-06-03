import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { patientsApi } from '../api/patients.js';
import { ApiError } from '../api/client.js';

const ERROR_MESSAGES = {
  NAME_REQUIRED: '請輸入姓名',
  INVALID_BIRTHDAY: '生日格式不正確',
  INVALID_LAST_VISIT: '最近看診日格式不正確',
  INVALID_INTERVAL: '回診間隔須為正整數',
};

const EMPTY = {
  name: '',
  phone: '',
  birthday: '',
  lastVisit: '',
  intervalMonths: 6,
  notes: '',
};

export default function PatientFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    patientsApi
      .get(id)
      .then((p) =>
        setForm({
          name: p.name ?? '',
          phone: p.phone ?? '',
          birthday: p.birthday ?? '',
          lastVisit: p.lastVisit ?? '',
          intervalMonths: p.intervalMonths ?? 6,
          notes: p.notes ?? '',
        })
      )
      .catch(() => setError('載入病患資料失敗'))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    const payload = {
      name: form.name,
      phone: form.phone || null,
      birthday: form.birthday || null,
      lastVisit: form.lastVisit || null,
      intervalMonths: Number(form.intervalMonths),
      notes: form.notes || null,
    };
    try {
      const saved = isEdit
        ? await patientsApi.update(id, payload)
        : await patientsApi.create(payload);
      navigate(`/patients/${saved.id}`);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      setError(ERROR_MESSAGES[code] ?? '儲存失敗，請稍後再試');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-slate-500">載入中…</div>;

  return (
    <div className="max-w-lg">
      <h1 className="mb-4 text-xl font-semibold text-slate-800">
        {isEdit ? '編輯病患' : '新增病患'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl bg-white p-6 shadow-sm">
        <Field label="姓名" id="name" required>
          <input
            id="name"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            className="input"
          />
        </Field>

        <Field label="電話" id="phone">
          <input
            id="phone"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            className="input"
          />
        </Field>

        <Field label="生日" id="birthday">
          <input
            id="birthday"
            type="date"
            value={form.birthday}
            onChange={(e) => update('birthday', e.target.value)}
            className="input"
          />
        </Field>

        <div className="flex gap-4">
          <Field label="最近看診日" id="lastVisit" className="flex-1">
            <input
              id="lastVisit"
              type="date"
              value={form.lastVisit}
              onChange={(e) => update('lastVisit', e.target.value)}
              className="input"
            />
          </Field>
          <Field label="回診間隔（月）" id="intervalMonths" className="w-40">
            <input
              id="intervalMonths"
              type="number"
              min="1"
              value={form.intervalMonths}
              onChange={(e) => update('intervalMonths', e.target.value)}
              className="input"
            />
          </Field>
        </div>

        <Field label="備註" id="notes">
          <textarea
            id="notes"
            rows={3}
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            className="input"
          />
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? '儲存中…' : '儲存'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            取消
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, id, required, className = '', children }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-600">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}
