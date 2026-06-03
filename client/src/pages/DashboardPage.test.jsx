import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage.jsx';

const get = vi.fn();
vi.mock('../api/dashboard.js', () => ({ dashboardApi: { get: () => get() } }));

describe('DashboardPage', () => {
  it('shows bucket counts and upcoming birthdays', async () => {
    get.mockResolvedValue({
      counts: { needLine: 3, needCall: 1, confirmed: 0, unreachable: 2 },
      totalActive: 42,
      birthdays: [{ id: 7, name: '王小明', birthday: '1990-06-10', daysUntil: 0 }],
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // needLine count
    expect(screen.getByText('王小明')).toBeInTheDocument();
    expect(screen.getByText(/今天/)).toBeInTheDocument();
  });
});
