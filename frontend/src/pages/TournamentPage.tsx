import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import type { Tournament, TournamentMatch, TournamentPlayer } from '../lib/api';
import { Avatar } from '../components/Avatar';
import { useAuthStore } from '../store/auth.store';

export function TournamentPage() {
  const user = useAuthStore((s) => s.user);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selected, setSelected] = useState<Tournament | null>(null);
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; avatarUrl?: string; avatarStyle?: string }[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.tournaments.all().then(setTournaments);
    if (user?.isAdmin) api.users.all().then(setAllUsers);
  }, [user]);

  async function refresh(id: string) {
    const t = await api.tournaments.one(id);
    setSelected(t);
    setTournaments((prev) => prev.map((x) => (x.id === id ? t : x)));
  }

  async function create() {
    if (!newName.trim()) return;
    setLoading(true);
    const t = await api.tournaments.create(newName);
    setTournaments([t, ...tournaments]);
    setSelected(t);
    setNewName('');
    setLoading(false);
  }

  async function addPlayer(userId: string) {
    if (!selected) return;
    await api.tournaments.addPlayer(selected.id, userId);
    await refresh(selected.id);
  }

  async function startTournament() {
    if (!selected) return;
    setLoading(true);
    const t = await api.tournaments.start(selected.id);
    setSelected(t);
    setLoading(false);
  }

  async function reportWinner(matchId: string, winnerId: string) {
    if (!selected) return;
    const t = await api.tournaments.reportWinner(matchId, winnerId);
    setSelected(t);
    setTournaments((prev) => prev.map((x) => (x.id === selected.id ? t : x)));
    setMsg('Winner recorded!');
    setTimeout(() => setMsg(''), 3000);
  }

  const addedIds = new Set(selected?.players.map((p) => p.userId) ?? []);
  const availableUsers = allUsers.filter((u) => !addedIds.has(u.id));

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h2 className="text-2xl font-bold text-yellow-400">Tournaments 🏆</h2>

      {msg && <div className="p-3 rounded-lg bg-green-900/30 border border-green-700 text-green-300 text-sm">{msg}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sidebar: list + create */}
        <div className="space-y-3">
          {user?.isAdmin && (
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && create()}
                placeholder="Tournament name"
                className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-yellow-500"
              />
              <button
                onClick={create}
                disabled={loading}
                className="px-3 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm transition"
              >
                +
              </button>
            </div>
          )}
          {tournaments.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelected(t)}
              className={`w-full text-left p-3 rounded-xl border transition ${selected?.id === t.id ? 'border-yellow-500 bg-yellow-900/20' : 'border-gray-800 bg-gray-900 hover:border-gray-600'}`}
            >
              <div className="font-semibold text-white text-sm">{t.name}</div>
              <div className="text-xs mt-0.5">
                <StatusBadge status={t.status} />
                <span className="text-gray-500 ml-2">{t.players.length} players</span>
              </div>
            </button>
          ))}
          {tournaments.length === 0 && <div className="text-gray-600 text-sm">No tournaments yet.</div>}
        </div>

        {/* Main: bracket + controls */}
        {selected ? (
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{selected.name}</h3>
              <StatusBadge status={selected.status} />
            </div>

            {/* Pending: add players + start */}
            {selected.status === 'pending' && user?.isAdmin && (
              <div className="p-4 rounded-xl bg-gray-900 border border-gray-800 space-y-3">
                <div className="text-sm text-gray-400 font-medium">Players ({selected.players.length})</div>
                <div className="flex flex-wrap gap-2">
                  {selected.players.map((p) => (
                    <div key={p.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-800 text-xs text-gray-300">
                      <Avatar name={p.user.name} avatarUrl={p.user.avatarUrl} avatarStyle={p.user.avatarStyle as any} size="sm" />
                      {p.user.name}
                    </div>
                  ))}
                </div>
                {availableUsers.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Add player:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {availableUsers.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => addPlayer(u.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs text-gray-300 transition"
                        >
                          <Avatar name={u.name} avatarUrl={u.avatarUrl} size="sm" />
                          {u.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {selected.players.length >= 2 && (
                  <button
                    onClick={startTournament}
                    disabled={loading}
                    className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm transition disabled:opacity-50"
                  >
                    Start Tournament
                  </button>
                )}
              </div>
            )}

            {/* Bracket */}
            {selected.status !== 'pending' && (
              <BracketView
                tournament={selected}
                isAdmin={!!user?.isAdmin}
                onReportWinner={reportWinner}
              />
            )}

            {selected.status === 'finished' && (
              <ChampionBanner tournament={selected} />
            )}
          </div>
        ) : (
          <div className="md:col-span-2 flex items-center justify-center text-gray-600 border border-dashed border-gray-800 rounded-xl min-h-[200px]">
            Select a tournament
          </div>
        )}
      </div>
    </div>
  );
}

function BracketView({
  tournament, isAdmin, onReportWinner,
}: {
  tournament: Tournament;
  isAdmin: boolean;
  onReportWinner: (matchId: string, winnerId: string) => void;
}) {
  const rounds = Array.from(new Set(tournament.matches.map((m) => m.round))).sort((a, b) => a - b);
  const playerMap = Object.fromEntries(tournament.players.map((p) => [p.userId, p.user]));

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-6 min-w-max">
        {rounds.map((round) => (
          <div key={round} className="flex flex-col gap-4">
            <div className="text-xs text-gray-500 text-center font-medium uppercase tracking-wide">
              {roundLabel(round, rounds.length)}
            </div>
            {tournament.matches
              .filter((m) => m.round === round)
              .sort((a, b) => a.seat - b.seat)
              .map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  playerMap={playerMap}
                  isAdmin={isAdmin}
                  onReportWinner={onReportWinner}
                />
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchCard({
  match, playerMap, isAdmin, onReportWinner,
}: {
  match: TournamentMatch;
  playerMap: Record<string, { name: string; avatarUrl?: string; avatarStyle?: string }>;
  isAdmin: boolean;
  onReportWinner: (matchId: string, winnerId: string) => void;
}) {
  const p1 = match.player1Id ? playerMap[match.player1Id] : null;
  const p2 = match.player2Id ? playerMap[match.player2Id] : null;
  const done = match.status === 'done';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`w-44 rounded-xl border ${done ? 'border-gray-700 bg-gray-900/50' : 'border-gray-600 bg-gray-900'}`}
    >
      {[{ id: match.player1Id, player: p1 }, { id: match.player2Id, player: p2 }].map(({ id, player }, i) => {
        const isWinner = match.winnerId === id;
        const isLoser = done && match.winnerId !== null && !isWinner && id !== null;
        return (
          <div
            key={i}
            className={`flex items-center gap-2 px-3 py-2 ${i === 0 ? 'rounded-t-xl border-b border-gray-800' : 'rounded-b-xl'}
              ${isWinner ? 'bg-yellow-900/30' : ''}
              ${isLoser ? 'opacity-40' : ''}
              ${!done && isAdmin && id ? 'cursor-pointer hover:bg-gray-700 transition' : ''}
            `}
            onClick={() => {
              if (!done && isAdmin && id) onReportWinner(match.id, id);
            }}
          >
            {player ? (
              <>
                <Avatar name={player.name} avatarUrl={player.avatarUrl} avatarStyle={player.avatarStyle as any} size="sm" />
                <span className={`text-xs flex-1 truncate ${isWinner ? 'text-yellow-400 font-bold' : 'text-gray-300'}`}>
                  {player.name}
                </span>
                {isWinner && <span className="text-yellow-400 text-xs">🏆</span>}
              </>
            ) : (
              <span className="text-xs text-gray-600 italic">BYE</span>
            )}
          </div>
        );
      })}
    </motion.div>
  );
}

function ChampionBanner({ tournament }: { tournament: Tournament }) {
  const winner = tournament.matches
    .filter((m) => m.round === Math.max(...tournament.matches.map((x) => x.round)))
    .find((m) => m.winnerId);
  if (!winner?.winnerId) return null;
  const champion = tournament.players.find((p) => p.userId === winner.winnerId);
  if (!champion) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-xl bg-gradient-to-br from-yellow-900/40 to-amber-900/20 border border-yellow-600/40 text-center"
    >
      <div className="text-4xl mb-2">🏆</div>
      <div className="text-sm text-yellow-500 uppercase tracking-widest mb-1">Champion</div>
      <div className="flex justify-center mb-2">
        <Avatar name={champion.user.name} avatarUrl={champion.user.avatarUrl} avatarStyle={champion.user.avatarStyle as any} size="lg" />
      </div>
      <div className="text-2xl font-bold text-yellow-400">{champion.user.name}</div>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-gray-800 text-gray-400',
    active: 'bg-blue-900/50 text-blue-400',
    finished: 'bg-yellow-900/50 text-yellow-400',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  );
}

function roundLabel(round: number, totalRounds: number): string {
  const remaining = totalRounds - round;
  if (remaining === 0) return 'Final';
  if (remaining === 1) return 'Semi-Final';
  if (remaining === 2) return 'Quarter-Final';
  return `Round ${round}`;
}
