import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

const NAV = [
  { to: '/', label: '今日待辦', end: true },
  { to: '/patients', label: '病患資料' },
  { to: '/dashboard', label: '儀表板' },
  { to: '/settings', label: '設定', role: 'ADMIN' },
  { to: '/users', label: '帳號管理', role: 'ADMIN' },
];

export default function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-full bg-slate-100">
      <aside className="flex w-56 flex-col border-r border-slate-200 bg-white">
        <div className="px-5 py-4 text-lg font-semibold text-slate-800">回診提醒</div>
        <nav className="flex-1 px-2">
          {NAV.filter((item) => !item.role || item.role === user?.role).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 px-5 py-3 text-sm">
          <div className="text-slate-700">{user?.displayName ?? user?.username}</div>
          <button
            onClick={logout}
            className="mt-1 text-xs text-slate-500 hover:text-red-600"
          >
            登出
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
