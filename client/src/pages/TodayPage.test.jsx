import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TodayPage from './TodayPage.jsx';

const today = vi.fn();
const sendLine = vi.fn();
vi.mock('../api/recalls.js', () => ({ recallsApi: { today: () => today() } }));
vi.mock('../api/cycles.js', () => ({
  cyclesApi: { sendLine: (...a) => sendLine(...a), recordCall: vi.fn() },
}));

const EMPTY = { needLine: [], needCall: [], confirmed: [], unreachable: [] };

function renderPage() {
  return render(
    <MemoryRouter>
      <TodayPage />
    </MemoryRouter>
  );
}

describe('TodayPage', () => {
  beforeEach(() => {
    today.mockReset();
    sendLine.mockReset();
  });

  it('renders a patient in the needLine bucket', async () => {
    today.mockResolvedValue({
      ...EMPTY,
      needLine: [{ cycleId: 1, patientId: 9, patientName: '王小明', recallDate: '2026-07-15', overdueDays: 2 }],
    });
    renderPage();
    expect(await screen.findByText('王小明')).toBeInTheDocument();
    expect(screen.getByText('逾期 2 天')).toBeInTheDocument();
  });

  it('sends LINE and reloads', async () => {
    today
      .mockResolvedValueOnce({
        ...EMPTY,
        needLine: [{ cycleId: 1, patientId: 9, patientName: '王小明', recallDate: '2026-07-15', overdueDays: 0 }],
      })
      .mockResolvedValue(EMPTY);
    sendLine.mockResolvedValue({});

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: '傳 LINE / 訊息' }));
    await waitFor(() => expect(sendLine).toHaveBeenCalledWith(1));
    await waitFor(() => expect(today).toHaveBeenCalledTimes(2));
  });
});
