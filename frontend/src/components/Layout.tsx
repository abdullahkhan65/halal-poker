import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { Avatar } from './Avatar';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const nav = useNavigate();
  const loc = useLocation();

  function handleLogout() {
    logout();
    nav('/login');
  }

  const navItems = [
    { to: '/lobby', label: 'Play' },
    { to: '/leaderboard', label: 'Leaderboard' },
    { to: '/tournaments', label: 'Tournaments' },
    { to: '/profile', label: 'Profile' },
    ...(user?.isAdmin ? [{ to: '/admin', label: 'Admin' }] : []),
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-6">
          <Link to="/lobby" className="text-yellow-400 font-bold text-lg tracking-tight">
            🃏 Halal Poker
          </Link>
          <nav className="flex gap-1 flex-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`px-3 py-1.5 rounded-lg text-sm transition ${
                  loc.pathname.startsWith(item.to)
                    ? 'text-yellow-400 bg-yellow-900/20'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {user && (
              <>
                <Avatar name={user.name} avatarUrl={user.avatarUrl} avatarStyle={(user as any).avatarStyle} size="sm" />
                <button
                  onClick={handleLogout}
                  className="text-xs text-gray-500 hover:text-gray-300 transition"
                >
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 py-6">
        {children}
      </main>
    </div>
  );
}
