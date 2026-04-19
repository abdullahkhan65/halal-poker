import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { User, Session } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import { useNavigate } from 'react-router-dom';

interface ChipEntry { userId: string; endChips: number; rebuys: number }

export function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const nav = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [invites, setInvites] = useState<{ id: string; code: string; createdBy: { name: string }; usedBy?: { name: string } }[]>([]);
  const [label, setLabel] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [chips, setChips] = useState<Record<string, string>>({});
  const [rebuys, setRebuys] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!user?.isAdmin) { nav('/'); return; }
    Promise.all([api.users.all(), api.sessions.all(), api.users.listInvites()])
      .then(([u, s, i]) => { setUsers(u); setSessions(s); setInvites(i); });
  }, [user]);

  async function createSession() {
    setLoading(true);
    try {
      const session = await api.sessions.create({ label, isOnline, date });
      setSessions([session, ...sessions]);
      setActiveSession(session);
      setLabel(''); setMsg('Session created!');
    } finally { setLoading(false); }
  }

  async function finalizeSession() {
    if (!activeSession) return;
    setLoading(true);
    try {
      const results: ChipEntry[] = Object.entries(chips)
        .filter(([, v]) => v !== '')
        .map(([userId, endChips]) => ({ userId, endChips: Number(endChips), rebuys: Number(rebuys[userId] ?? 0) }));
      const updated = await api.sessions.finalize(activeSession.id, results);
      setSessions(sessions.map((s) => (s.id === updated.id ? updated : s)));
      setActiveSession(updated);
      setChips({}); setRebuys({});
      setMsg('Session finalized! Earnings updated.');
      const l = await api.users.all();
      setUsers(l);
    } finally { setLoading(false); }
  }

  async function generateInvite() {
    const invite = await api.users.createInvite();
    setInvites([{ ...invite, createdBy: { name: user!.name } }, ...invites] as any);
    setMsg(`Invite created: ${invite.code}`);
  }

  if (!user?.isAdmin) return null;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <h2 className="text-2xl font-bold text-yellow-400">Admin Panel</h2>

      {msg && (
        <div className="p-3 rounded-lg bg-green-900/30 border border-green-700 text-green-300 text-sm">
          {msg}
        </div>
      )}

      <section className="p-5 rounded-xl bg-gray-900 border border-gray-800 space-y-4">
        <h3 className="font-semibold text-white">Create Session</h3>
        <div className="grid grid-cols-2 gap-3">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Session label (e.g. Friday Night)"
            className="col-span-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-yellow-500"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-yellow-500"
          />
          <label className="flex items-center gap-2 text-gray-400 text-sm">
            <input type="checkbox" checked={isOnline} onChange={(e) => setIsOnline(e.target.checked)} className="accent-yellow-500" />
            Online session
          </label>
        </div>
        <button
          onClick={createSession}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm transition disabled:opacity-50"
        >
          Create Session
        </button>
      </section>

      {activeSession && (
        <section className="p-5 rounded-xl bg-gray-900 border border-gray-800 space-y-4">
          <h3 className="font-semibold text-white">
            Enter Results — <span className="text-yellow-400">{activeSession.label ?? 'Session'}</span>
          </h3>
          <p className="text-xs text-gray-400">Starting chips: 20,000 per player. Profit = end chips − (20,000 × (1 + rebuys))</p>
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 gap-y-2 items-center">
            <div className="text-xs text-gray-600">Player</div>
            <div className="text-xs text-gray-600 text-right">Rebuys</div>
            <div className="text-xs text-gray-600 text-right">End chips</div>
            <div className="text-xs text-gray-600 text-right">Profit</div>
            {users.map((u) => {
              const endChips = Number(chips[u.id] ?? 0);
              const rb = Number(rebuys[u.id] ?? 0);
              const profit = chips[u.id] ? endChips - 20000 * (1 + rb) : null;
              return (
                <>
                  <span key={`n-${u.id}`} className="text-sm text-gray-300">{u.name}</span>
                  <input
                    key={`r-${u.id}`}
                    type="number"
                    min={0}
                    placeholder="0"
                    value={rebuys[u.id] ?? ''}
                    onChange={(e) => setRebuys({ ...rebuys, [u.id]: e.target.value })}
                    className="w-16 px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-purple-500 font-mono text-center"
                  />
                  <input
                    key={`c-${u.id}`}
                    type="number"
                    placeholder="—"
                    value={chips[u.id] ?? ''}
                    onChange={(e) => setChips({ ...chips, [u.id]: e.target.value })}
                    className="w-28 px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-yellow-500 font-mono"
                  />
                  <span key={`p-${u.id}`} className={`text-sm font-mono font-bold text-right ${profit === null ? 'text-gray-700' : profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {profit === null ? '—' : `${profit >= 0 ? '+' : ''}${profit.toLocaleString()}`}
                  </span>
                </>
              );
            })}
          </div>
          <button
            onClick={finalizeSession}
            disabled={loading || Object.keys(chips).length === 0}
            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold text-sm transition disabled:opacity-50"
          >
            Finalize & Save Results
          </button>
        </section>
      )}

      {sessions.length > 0 && !activeSession && (
        <section className="p-5 rounded-xl bg-gray-900 border border-gray-800 space-y-3">
          <h3 className="font-semibold text-white">Select Session to Edit</h3>
          <div className="space-y-2">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSession(s)}
                className="w-full text-left px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition"
              >
                {s.label ?? 'Session'} — {new Date(s.date).toLocaleDateString()}
                <span className="ml-2 text-xs text-gray-500">({s.results.length} results)</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="p-5 rounded-xl bg-gray-900 border border-gray-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">Invite Codes</h3>
          <button
            onClick={generateInvite}
            className="px-3 py-1 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs transition"
          >
            + Generate
          </button>
        </div>
        <div className="space-y-2">
          {invites.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 text-sm">
              <code className="font-mono text-yellow-300 bg-gray-800 px-2 py-1 rounded tracking-widest">{inv.code}</code>
              <span className="text-gray-500 text-xs flex-1">
                by {inv.createdBy.name}
                {inv.usedBy ? <span className="text-green-400"> · used by {inv.usedBy.name}</span> : <span className="text-gray-600"> · unused</span>}
              </span>
            </div>
          ))}
          {invites.length === 0 && <div className="text-gray-500 text-sm">No invite codes yet.</div>}
        </div>
      </section>
    </div>
  );
}
