import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api, User, Session } from '../lib/api';
import { Avatar } from '../components/Avatar';

export function LeaderboardPage() {
  const [leaders, setLeaders] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.users.leaderboard(), api.sessions.all()])
      .then(([l, s]) => { setLeaders(l); setSessions(s); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center items-center h-64 text-gray-400">Loading...</div>;

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-yellow-400 mb-4">Leaderboard</h2>
        <div className="space-y-3">
          {leaders.map((user, i) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 p-4 rounded-xl bg-gray-900 border border-gray-800"
            >
              <span className="text-2xl w-8 text-center">{medals[i] ?? `#${i + 1}`}</span>
              <Avatar name={user.name} avatarUrl={user.avatarUrl} size="md" />
              <div className="flex-1">
                <div className="font-semibold text-white">{user.name}</div>
                <div className="text-xs text-gray-400">{user.email}</div>
              </div>
              <div className={`font-mono font-bold text-lg ${user.totalEarnings >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {user.totalEarnings > 0 ? '+' : ''}{user.totalEarnings.toLocaleString()}
              </div>
            </motion.div>
          ))}
          {leaders.length === 0 && (
            <div className="text-center py-12 text-gray-500">No sessions played yet.</div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-yellow-400 mb-4">Session History</h2>
        <div className="space-y-4">
          {sessions.map((session) => (
            <div key={session.id} className="p-4 rounded-xl bg-gray-900 border border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-semibold text-white">{session.label ?? 'Session'}</span>
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
                    {session.isOnline ? '🌐 Online' : '🏠 Offline'}
                  </span>
                </div>
                <span className="text-xs text-gray-500">{new Date(session.date).toLocaleDateString()}</span>
              </div>
              <div className="space-y-2">
                {session.results.sort((a, b) => b.profit - a.profit).map((r) => (
                  <div key={r.id} className="flex items-center gap-3 text-sm">
                    <Avatar name={r.user.name} avatarUrl={r.user.avatarUrl} size="sm" />
                    <span className="flex-1 text-gray-300">{r.user.name}</span>
                    <span className="text-gray-500 text-xs">{r.endChips.toLocaleString()} chips</span>
                    <span className={`font-mono font-bold ${r.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {r.profit > 0 ? '+' : ''}{r.profit.toLocaleString()}
                    </span>
                  </div>
                ))}
                {session.results.length === 0 && (
                  <div className="text-xs text-gray-600 italic">No results recorded</div>
                )}
              </div>
            </div>
          ))}
          {sessions.length === 0 && (
            <div className="text-center py-8 text-gray-500">No sessions yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
