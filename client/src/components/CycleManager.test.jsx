import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import CycleManager from './CycleManager.jsx';

const setStep = vi.fn();
const setStatus = vi.fn();
const close = vi.fn();
const reschedule = vi.fn();
vi.mock('../api/cycles.js', () => ({
  cyclesApi: {
    setStep: (...a) => setStep(...a),
    setStatus: (...a) => setStatus(...a),
    close: (...a) => close(...a),
  },
}));
vi.mock('../api/patients.js', () => ({
  patientsApi: { reschedule: (...a) => reschedule(...a) },
}));

const cycle = {
  id: 1,
  step: 'LINE_SENT',
  status: 'UNCONFIRMED',
  lineSentAt: '2026-05-01T00:00:00.000Z',
  callLogs: [],
};
const patient = { id: 9, name: '王小明', intervalMonths: 6 };

function renderManager() {
  const onChanged = vi.fn().mockResolvedValue();
  render(
    <MemoryRouter>
      <CycleManager cycle={cycle} patient={patient} onChanged={onChanged} />
    </MemoryRouter>
  );
  return onChanged;
}

describe('CycleManager', () => {
  beforeEach(() => {
    setStep.mockReset().mockResolvedValue({});
    setStatus.mockReset().mockResolvedValue({});
    close.mockReset().mockResolvedValue({});
    reschedule.mockReset().mockResolvedValue({});
  });

  it('sets the step when a stepper node is clicked', async () => {
    const onChanged = renderManager();
    await userEvent.click(screen.getByRole('button', { name: '2' })); // 電話 1
    await waitFor(() => expect(setStep).toHaveBeenCalledWith(1, 'CALL_1'));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });

  it('confirms the recall via the status toggle', async () => {
    renderManager();
    await userEvent.click(screen.getByRole('button', { name: '標記確認複診' }));
    await waitFor(() => expect(setStatus).toHaveBeenCalledWith(1, 'CONFIRMED'));
  });

  it('marks the cycle unreachable', async () => {
    renderManager();
    await userEvent.click(screen.getByRole('button', { name: '標記未聯絡上' }));
    await waitFor(() => expect(close).toHaveBeenCalledWith(1, 'NO_RESPONSE'));
  });

  it('reschedules through the modal (when confirmed)', async () => {
    const onChanged = vi.fn().mockResolvedValue();
    render(
      <MemoryRouter>
        <CycleManager cycle={{ ...cycle, status: 'CONFIRMED' }} patient={patient} onChanged={onChanged} />
      </MemoryRouter>
    );
    await userEvent.click(screen.getByRole('button', { name: '安排下次看診' }));
    await userEvent.click(await screen.findByRole('button', { name: '確認並安排' }));
    await waitFor(() => expect(reschedule).toHaveBeenCalledWith(9, expect.objectContaining({ intervalMonths: 6 })));
  });
});
