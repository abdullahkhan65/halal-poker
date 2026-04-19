import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { Avatar } from './Avatar';
import type { AvatarStyle } from './Avatar';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const nav = useNavigate();
  const loc = useLocation();

  function handleLogout() { logout(); nav('/login'); }

  const navItems = [
    { to: '/lobby', label: 'Play' },
    { to: '/leaderboard', label: 'Leaderboard' },
    { to: '/tournaments', label: 'Tournaments' },
    { to: '/profile', label: 'Profile' },
    ...(user?.isAdmin ? [{ to: '/admin', label: 'Admin' }] : []),
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#050507' }}>
      <header style={{
        background: 'rgba(4, 4, 8, 0.97)',
        borderBottom: '1px solid rgba(201, 160, 96, 0.15)',
        backdropFilter: 'blur(20px)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        {/* Gold top line */}
        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(201,160,96,0.6), transparent)' }} />

        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-8">
          {/* Logo */}
          <Link to="/lobby" style={{ textDecoration: 'none' }}>
            <span className="font-display shimmer-text" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.05em' }}>
              ♦ HALAL POKER
            </span>
          </Link>

          {/* Nav */}
          <nav className="flex gap-1 flex-1">
            {navItems.map((item) => {
              const active = loc.pathname.startsWith(item.to);
              return (
                <Link key={item.to} to={item.to} style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  letterSpacing: '0.02em',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  color: active ? '#e8c97a' : 'rgba(232, 220, 200, 0.5)',
                  background: active ? 'rgba(201, 160, 96, 0.08)' : 'transparent',
                  borderBottom: active ? '1px solid rgba(201,160,96,0.4)' : '1px solid transparent',
                }}>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User */}
          {user && (
            <div className="flex items-center gap-3">
              <div style={{
                padding: '2px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #c9a060, #8c6a30)',
              }}>
                <Avatar
                  name={user.name}
                  avatarUrl={user.avatarUrl}
                  avatarStyle={(user as any).avatarStyle as AvatarStyle}
                  size="sm"
                />
              </div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#e8dcc8', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.name}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(201,160,96,0.7)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {user.totalEarnings >= 0 ? '+' : ''}{user.totalEarnings.toLocaleString()}
                </div>
              </div>
              <button onClick={handleLogout} style={{
                fontSize: 11, color: 'rgba(232,220,200,0.35)', background: 'none',
                border: 'none', cursor: 'pointer', transition: 'color 0.2s',
              }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(232,220,200,0.7)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(232,220,200,0.35)')}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 py-8">{children}</main>
    </div>
  );
}
