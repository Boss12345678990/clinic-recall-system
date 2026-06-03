import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage.jsx';

const login = vi.fn();
vi.mock('../auth/AuthContext.jsx', () => ({
  useAuth: () => ({ login }),
}));

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig()),
  useNavigate: () => navigate,
  useLocation: () => ({ state: null }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    login.mockReset();
    navigate.mockReset();
  });

  it('submits entered credentials and navigates on success', async () => {
    login.mockResolvedValue({ id: 1 });
    renderPage();

    await userEvent.type(screen.getByLabelText('帳號'), 'admin');
    await userEvent.type(screen.getByLabelText('密碼'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: '登入' }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('admin', 'secret'));
    expect(navigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('shows an error message when login fails', async () => {
    const { ApiError } = await import('../api/client.js');
    login.mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS'));
    renderPage();

    await userEvent.type(screen.getByLabelText('帳號'), 'admin');
    await userEvent.type(screen.getByLabelText('密碼'), 'bad');
    await userEvent.click(screen.getByRole('button', { name: '登入' }));

    expect(await screen.findByText('帳號或密碼錯誤')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });
});
