import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PatientsPage from './PatientsPage.jsx';

const list = vi.fn();
vi.mock('../api/patients.js', () => ({
  patientsApi: { list: (...a) => list(...a) },
}));

vi.mock('react-router-dom', async (orig) => ({
  ...(await orig()),
  useNavigate: () => vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <PatientsPage />
    </MemoryRouter>
  );
}

describe('PatientsPage', () => {
  beforeEach(() => list.mockReset());

  it('renders patients returned from the API', async () => {
    list.mockResolvedValue([
      { id: 1, name: '王小明', phone: '0912', lastVisit: '2026-01-15', recallDate: '2026-07-15', status: 'ACTIVE' },
    ]);
    renderPage();
    expect(await screen.findByText('王小明')).toBeInTheDocument();
    expect(screen.getByText('2026-07-15')).toBeInTheDocument();
  });

  it('debounces and passes the search query to the API', async () => {
    list.mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(list).toHaveBeenCalledWith(''));

    await userEvent.type(screen.getByLabelText('搜尋姓名或電話'), '王');
    await waitFor(() => expect(list).toHaveBeenLastCalledWith('王'));
    expect(await screen.findByText('查無符合的病患')).toBeInTheDocument();
  });
});
