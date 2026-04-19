import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { api } from './lib/api';
import { connectSocket, disconnectSocket } from './lib/socket';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { LobbyPage } from './pages/LobbyPage';
import { TablePage } from './pages/TablePage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { AdminPage } from './pages/AdminPage';
import { ProfilePage } from './pages/ProfilePage';
import { TournamentPage } from './pages/TournamentPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (!user) return <div className="flex items-center justify-center min-h-screen text-gray-400">Loading...</div>;
  return <>{children}</>;
}

export default function App() {
  const { token, setAuth, logout } = useAuthStore();

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      return;
    }
    api.auth.me()
      .then((user) => { setAuth(user, token); connectSocket(); })
      .catch(() => logout());
  }, [token]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/lobby" replace />} />
        <Route path="/lobby" element={<RequireAuth><Layout><LobbyPage /></Layout></RequireAuth>} />
        <Route path="/table/:tableId" element={<RequireAuth><TablePage /></RequireAuth>} />
        <Route path="/leaderboard" element={<RequireAuth><Layout><LeaderboardPage /></Layout></RequireAuth>} />
        <Route path="/tournaments" element={<RequireAuth><Layout><TournamentPage /></Layout></RequireAuth>} />
        <Route path="/admin" element={<RequireAuth><Layout><AdminPage /></Layout></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><Layout><ProfilePage /></Layout></RequireAuth>} />
      </Routes>
    </BrowserRouter>
  );
}
