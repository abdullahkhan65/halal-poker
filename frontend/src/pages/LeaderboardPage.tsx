import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import type { User, Session } from '../lib/api';
import { Avatar } from '../components/Avatar';

const RANK_STYLES = [
  { icon: '♛', color: '#e8c97a', bg: 'rgba(201,160,96,0.1)', border: 'rgba(201,160,96,0.3)' },
  { icon: '♜', color: '#b0c4de', bg: 'rgba(176,196,222,0.07)', border: 'rgba(176,196,222,0.2)' },
  { icon: '♞', color: '#cd7f32', bg: 'rgba(205,127,50,0.07)', border: 'rgba(205,127,50,0.2)' },
];

export function LeaderboardPage() {
  const [leaders, setLeaders] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.users.leaderboard(), api.sessions.all()])
      .then(([l, s]) => { setLeaders(l); setSessions(s); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div className="shimmer-text font-display" style={{ fontSize: 20 }}>Loading…</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px' }}>

      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div style={{
          display: 'inline-block', padding: '4px 16px', borderRadius: 100, marginBottom: 12,
          background: 'rgba(201,160,96,0.08)', border: '1px solid rgba(201,160,96,0.2)',
          fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(201,160,96,0.6)',
        }}>
          Hall of Fame
        </div>
        <h2 className="font-display" style={{ fontSize: 36, fontWeight: 700, margin: 0, color: '#e8dcc8', letterSpacing: '0.02em' }}>
          The Champions
        </h2>
      </div>

      {/* Leaderboard */}
      <div style={{ marginBottom: 52 }}>
        {leaders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(201,160,96,0.3)', fontSize: 14 }}>
            No sessions played yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {leaders.map((user, i) => {
              const rank = RANK_STYLES[i];
              return (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px',
                    borderRadius: 14,
                    background: rank ? rank.bg : 'rgba(10,10,16,0.6)',
                    border: `1px solid ${rank ? rank.border : 'rgba(255,255,255,0.06)'}`,
                    boxShadow: i === 0 ? '0 4px 30px rgba(201,160,96,0.12)' : 'none',
                  }}
                >
                  <span style={{ fontSize: 22, width: 32, textAlign: 'center', flexShrink: 0, color: rank?.color ?? 'rgba(255,255,255,0.3)' }}>
                    {rank?.icon ?? `#${i + 1}`}
                  </span>
                  <div style={{
                    padding: 2, borderRadius: '50%',
                    background: rank ? `linear-gradient(135deg, ${rank.color}, rgba(0,0,0,0))` : 'rgba(255,255,255,0.06)',
                  }}>
                    <Avatar name={user.name} avatarUrl={user.avatarUrl} avatarStyle={(user as any).avatarStyle} size="md" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: '#e8dcc8' }}>{user.name}</div>
                    <div style={{ fontSize: 11, color: 'rgba(232,220,200,0.3)', marginTop: 2 }}>{user.email}</div>
                  </div>
                  <div style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 20, fontWeight: 700,
                    color: user.totalEarnings >= 0 ? '#4ade80' : '#f87171',
                  }}>
                    {user.totalEarnings > 0 ? '+' : ''}{user.totalEarnings.toLocaleString()}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Session History */}
      <div>
        <div style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(201,160,96,0.4)', marginBottom: 16, fontWeight: 600 }}>
          Session History
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sessions.map((session, si) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: si * 0.04 }}
              style={{
                background: 'rgba(10,10,16,0.7)', borderRadius: 14,
                border: '1px solid rgba(201,160,96,0.1)',
                overflow: 'hidden',
              }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 18px',
                borderBottom: session.results.length ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 600, color: '#e8dcc8', fontSize: 14 }}>{session.label ?? 'Session'}</span>
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 100,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(232,220,200,0.4)', letterSpacing: '0.05em',
                  }}>
                    {session.isOnline ? '⬡ Online' : '⌂ In-Person'}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: 'rgba(232,220,200,0.25)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {new Date(session.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>

              <div style={{ padding: '10px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {session.results.sort((a, b) => b.profit - a.profit).map((r) => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Avatar name={r.user.name} avatarUrl={r.user.avatarUrl} avatarStyle={(r.user as any).avatarStyle} size="sm" />
                    <span style={{ flex: 1, fontSize: 13, color: 'rgba(232,220,200,0.7)', fontWeight: 500 }}>{r.user.name}</span>
                    <span style={{ fontSize: 11, color: 'rgba(232,220,200,0.25)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {r.endChips.toLocaleString()}
                    </span>
                    <span style={{
                      fontSize: 14, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', minWidth: 64, textAlign: 'right',
                      color: r.profit >= 0 ? '#4ade80' : '#f87171',
                    }}>
                      {r.profit > 0 ? '+' : ''}{r.profit.toLocaleString()}
                    </span>
                  </div>
                ))}
                {session.results.length === 0 && (
                  <div style={{ fontSize: 12, color: 'rgba(201,160,96,0.25)', fontStyle: 'italic' }}>No results recorded</div>
                )}
              </div>
            </motion.div>
          ))}
          {sessions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(201,160,96,0.25)', fontSize: 14 }}>
              No sessions yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
