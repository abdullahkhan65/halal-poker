import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { connectSocket } from '../lib/socket';
import { useGameStore } from '../store/game.store';
import type { GameState, PlayerState } from '../store/game.store';
import { useAuthStore } from '../store/auth.store';
import { PlayingCard } from '../components/PlayingCard';
import { Avatar } from '../components/Avatar';
import type { AvatarStyle } from '../components/Avatar';
import { VoiceChat } from '../components/VoiceChat';
import { useVoiceChat } from '../hooks/useVoiceChat';
import { evaluateHandRank } from '../lib/handEvaluator';

const ROUND_LABELS: Record<string, string> = {
  preflop: 'Pre-Flop', flop: 'Flop', turn: 'Turn', river: 'River', showdown: 'Showdown',
};
const TURN_SECONDS = 30;

interface ChatMsg {
  userId: string; name: string; avatarUrl?: string; avatarStyle?: string;
  message: string; timestamp: number;
}

type PreAction = 'fold' | 'check-or-fold' | 'call-any' | null;

function getSeatStyle(seatIndex: number, total: number, myIndex: number) {
  const order = (seatIndex - myIndex + total) % total;
  const deg = 270 + (360 / total) * order;
  const rad = (deg * Math.PI) / 180;
  return { left: `${50 + 41 * Math.cos(rad)}%`, top: `${50 - 35 * Math.sin(rad)}%` };
}

function getBetStyle(seatIndex: number, total: number, myIndex: number) {
  const order = (seatIndex - myIndex + total) % total;
  const deg = 270 + (360 / total) * order;
  const rad = (deg * Math.PI) / 180;
  return { left: `${50 + 24 * Math.cos(rad)}%`, top: `${50 - 19 * Math.sin(rad)}%` };
}

export function TablePage() {
  const { tableId } = useParams<{ tableId: string }>();
  const nav = useNavigate();
  const { currentGame, setGame } = useGameStore();
  const user = useAuthStore((s) => s.user);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [showRaise, setShowRaise] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);
  const [preAction, setPreAction] = useState<PreAction>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [unread, setUnread] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef(connectSocket());
  const prevRoundRef = useRef<string | undefined>();
  // refs so the pre-action timeout always sees fresh values
  const preActionRef = useRef<PreAction>(null);
  const canCheckRef = useRef(false);

  const { peers, muted, active, error: voiceError, join: joinVoice, leave: leaveVoice, toggleMute } =
    useVoiceChat(socketRef.current, tableId ?? null, user?.id ?? null);

  useEffect(() => {
    if (!tableId || !user) return;
    const socket = socketRef.current;
    socket.emit('join_table', {
      tableId, chips: 20000,
      name: user.name,
      avatarUrl: user.avatarUrl ?? null,
      avatarStyle: (user as any).avatarStyle ?? null,
    }, (state: GameState) => { if (state) setGame(state); });

    socket.on('game_state', (state: GameState) => setGame(state));
    socket.on('chat_message', (msg: ChatMsg) => {
      setMessages((prev) => [...prev, msg]);
      setChatOpen((open) => {
        if (!open) setUnread((u) => u + 1);
        return open;
      });
    });

    return () => {
      socket.off('game_state');
      socket.off('chat_message');
      socket.emit('leave_table', { tableId });
      leaveVoice();
    };
  }, [tableId, user]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Clear unread when opening chat
  useEffect(() => { if (chatOpen) setUnread(0); }, [chatOpen]);

  const game = currentGame;

  // Countdown timer
  useEffect(() => {
    if (!game?.turnExpiresAt || game.status !== 'playing') { setTimeLeft(TURN_SECONDS); return; }
    const tick = () => setTimeLeft(Math.max(0, Math.ceil((game.turnExpiresAt! - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [game?.turnExpiresAt, game?.status]);

  // Reset pre-action on new round
  useEffect(() => {
    if (game?.round && game.round !== prevRoundRef.current) {
      setPreAction(null);
      prevRoundRef.current = game.round;
    }
  }, [game?.round]);

  // Auto-execute pre-action when turn arrives
  const isMyTurn = game?.status === 'playing' && game.players?.[game.activePlayerIndex]?.id === user?.id;
  const myIdx = game?.players?.findIndex((p) => p.id === user?.id) ?? -1;
  const myPlayer = myIdx >= 0 ? game?.players[myIdx] : null;
  const canCheck = isMyTurn && game?.currentBet === (myPlayer?.bet ?? 0);

  // keep refs fresh every render so the timeout closure always sees latest values
  preActionRef.current = preAction;
  canCheckRef.current = canCheck;

  useEffect(() => {
    if (!isMyTurn || !preActionRef.current || myPlayer?.folded) return;
    const timeout = setTimeout(() => {
      const pa = preActionRef.current;
      const cc = canCheckRef.current;
      if (pa === 'fold') act('fold');
      else if (pa === 'check-or-fold') act(cc ? 'check' : 'fold');
      else if (pa === 'call-any') act(cc ? 'check' : 'call');
      setPreAction(null);
    }, 300);
    return () => clearTimeout(timeout);
  }, [isMyTurn]);

  function startGame() {
    socketRef.current.emit('start_game', { tableId }, (state: GameState) => {
      if (state) setGame(state);
    });
  }

  function act(action: string, raise?: number) {
    socketRef.current.emit('player_action', { tableId, action, raiseAmount: raise }, (state: GameState) => {
      if (state) setGame(state);
    });
    setShowRaise(false);
  }

  function sendChat() {
    const msg = chatInput.trim();
    if (!msg || !tableId) return;
    socketRef.current.emit('chat_message', { tableId, message: msg });
    setChatInput('');
  }

  if (!game) {
    return <div className="flex justify-center items-center h-screen bg-[#0a0a0a] text-gray-400">Connecting to table...</div>;
  }

  const effectiveMyIdx = myIdx >= 0 ? myIdx : 0;
  const callAmount = Math.max(0, (game.currentBet ?? 0) - (myPlayer?.bet ?? 0));
  const minRaise = game.minRaise ?? game.bigBlind;
  const n = game.players?.length ?? 1;
  const sbIdx = (game.dealerIndex + 1) % n;
  const bbIdx = (game.dealerIndex + 2) % n;

  const handStrength =
    (myPlayer?.holeCards?.length ?? 0) >= 2 && game.status === 'playing'
      ? evaluateHandRank([...(myPlayer?.holeCards ?? []), ...(game.communityCards ?? [])])
      : null;

  const halfPot = Math.max(minRaise, Math.round((game.pot / 2) / (game.bigBlind || 1)) * (game.bigBlind || 1));
  const fullPot = Math.max(minRaise, Math.round(game.pot / (game.bigBlind || 1)) * (game.bigBlind || 1));

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col select-none overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-900 flex-shrink-0">
        <button onClick={() => nav('/lobby')} className="text-gray-500 hover:text-gray-300 text-sm transition">
          ← Back to Lobby
        </button>
        <div className="text-center">
          <span className="text-yellow-400 font-bold text-sm">{ROUND_LABELS[game.round] ?? game.round}</span>
          {game.pot > 0 && (
            <span className="ml-3 text-gray-400 text-sm">
              Pot: <span className="text-white font-mono font-bold">{game.pot.toLocaleString()}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Chat button */}
          <button
            onClick={() => setChatOpen((o) => !o)}
            className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
            title="Table chat"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-500 text-black text-[9px] font-black flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          <VoiceChat
            active={active} muted={muted} peers={peers} error={voiceError}
            onJoin={joinVoice} onLeave={leaveVoice} onToggleMute={toggleMute}
          />
        </div>
      </div>

      {/* Main area: table */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Oval table */}
        <div className="flex-1 flex items-center justify-center p-3 min-h-0">
          <div className="relative" style={{ width: 'min(100%, calc((100vh - 230px) * 3 / 2))', aspectRatio: '3/2' }}>
            <div className="absolute inset-0 rounded-[50%] bg-gradient-to-br from-[#7a4520] via-[#5a3010] to-[#3d1f08] shadow-[0_0_60px_rgba(0,0,0,0.8)]" />
            <div className="absolute inset-[10px] rounded-[50%] bg-gradient-to-br from-[#1e6e38] via-[#165429] to-[#0f3a1d]" />
            <div className="absolute inset-[22px] rounded-[50%] bg-gradient-to-br from-[#25803f]/20 to-transparent pointer-events-none" />

            {/* Center */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 z-10 pointer-events-none">
              <AnimatePresence mode="wait">
                {game.pot > 0 && (
                  <motion.div key={game.pot} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center gap-1.5 bg-black/50 rounded-full px-3 py-0.5 mb-0.5">
                    <span className="text-yellow-500 text-[10px] font-bold tracking-widest uppercase">Pot</span>
                    <span className="text-white font-mono font-bold text-sm">{game.pot.toLocaleString()}</span>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex gap-1">
                <AnimatePresence>
                  {(game.communityCards ?? []).map((card, i) => (
                    <motion.div key={`${card.rank}${card.suit}`}
                      initial={{ y: -20, opacity: 0, scale: 0.8 }}
                      animate={{ y: 0, opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.1, type: 'spring', stiffness: 300, damping: 20 }}>
                      <PlayingCard card={card} small />
                    </motion.div>
                  ))}
                </AnimatePresence>
                {!(game.communityCards ?? []).length && game.status === 'waiting' && (
                  <span className="text-gray-600 text-xs italic">Waiting to start...</span>
                )}
              </div>
              {handStrength && (
                <motion.div key={handStrength} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-black/75 text-yellow-300 text-[11px] font-bold px-3 py-0.5 rounded-full border border-yellow-600/40 mt-0.5">
                  {handStrength}
                </motion.div>
              )}
            </div>

            {/* Winner overlay */}
            <AnimatePresence>
              {game.status === 'finished' && game.winnerId && (
                <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                  className="absolute inset-[10px] rounded-[50%] flex items-center justify-center bg-black/85 z-30">
                  <div className="text-center px-6">
                    <div className="text-4xl mb-1">🏆</div>
                    <div className="text-xl font-bold text-yellow-400">
                      {game.players?.find((p) => p.id === game.winnerId)?.name}
                    </div>
                    <div className="text-gray-300 text-sm mt-0.5">{game.handRank}</div>
                    <div className="text-green-400 font-mono font-bold text-lg">+{game.winnerAmount?.toLocaleString()}</div>
                    {game.players?.find((p) => p.id === game.winnerId)?.id === user?.id && (
                      <div className="text-yellow-300 text-sm mt-1">You won!</div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bet chips */}
            {game.players?.map((player, i) =>
              player.bet > 0 ? (
                <motion.div key={`bet-${player.id}`} initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="absolute z-20 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                  style={getBetStyle(i, n, effectiveMyIdx)}>
                  <div className="bg-yellow-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap">
                    {player.bet.toLocaleString()}
                  </div>
                </motion.div>
              ) : null
            )}

            {/* Seats */}
            {game.players?.map((player, i) => (
              <div key={player.id} className="absolute z-20 transform -translate-x-1/2 -translate-y-1/2"
                style={getSeatStyle(i, n, effectiveMyIdx)}>
                <SeatCard
                  player={player}
                  isActive={i === game.activePlayerIndex && game.status === 'playing'}
                  isMe={player.id === user?.id}
                  isDealer={i === game.dealerIndex}
                  isSB={i === sbIdx} isBB={i === bbIdx}
                  timeLeft={i === game.activePlayerIndex && game.status === 'playing' ? timeLeft : null}
                />
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Chat overlay — fixed, slides in from right, floats over the table */}
      <AnimatePresence>
        {chatOpen && (
          <>
            {/* Backdrop — click to close */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
              onClick={() => setChatOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed right-0 top-0 bottom-0 w-72 bg-gray-950/95 border-l border-gray-800 z-50 flex flex-col backdrop-blur-sm"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
                <span className="font-semibold text-white text-sm">Table Chat</span>
                <button onClick={() => setChatOpen(false)} className="text-gray-500 hover:text-white text-lg leading-none transition">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
                {messages.length === 0 && (
                  <p className="text-gray-600 text-xs text-center mt-4">No messages yet. Say something!</p>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={`flex gap-2 items-start ${msg.userId === user?.id ? 'flex-row-reverse' : ''}`}>
                    <div className="flex-shrink-0">
                      <Avatar name={msg.name} avatarUrl={msg.avatarUrl} avatarStyle={msg.avatarStyle as AvatarStyle | undefined} size="sm" />
                    </div>
                    <div className={`max-w-[170px] flex flex-col ${msg.userId === user?.id ? 'items-end' : 'items-start'}`}>
                      <span className="text-[10px] text-gray-500 mb-0.5">{msg.name}</span>
                      <div className={`px-3 py-1.5 rounded-2xl text-sm break-words ${
                        msg.userId === user?.id ? 'bg-yellow-600 text-black rounded-tr-sm' : 'bg-gray-800 text-white rounded-tl-sm'
                      }`}>
                        {msg.message}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="p-3 border-t border-gray-800 flex-shrink-0">
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') sendChat(); }}
                    placeholder="Message..."
                    maxLength={300}
                    autoFocus
                    className="flex-1 px-3 py-1.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-yellow-500 transition"
                  />
                  <button onClick={sendChat} disabled={!chatInput.trim()}
                    className="px-3 py-1.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm transition disabled:opacity-40">
                    ↑
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Action bar */}
      <div className="flex-shrink-0 px-4 pb-5 pt-1">
        {game.status === 'waiting' && n >= 2 && (
          <div className="flex justify-center">
            <button onClick={startGame}
              className="px-10 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-lg transition">
              Start Game
            </button>
          </div>
        )}

        {isMyTurn && !myPlayer?.folded && (
          <div className="flex flex-col items-center gap-2 max-w-lg mx-auto">
            {/* Timer bar */}
            <div className="w-full h-1 rounded-full bg-gray-800 overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${timeLeft > 20 ? 'bg-green-500' : timeLeft > 10 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${(timeLeft / TURN_SECONDS) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            <AnimatePresence>
              {showRaise && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                  className="w-full bg-gray-900/90 border border-gray-800 rounded-xl p-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Raise to</span>
                    <span className="text-white font-mono font-bold">{(raiseAmount || minRaise).toLocaleString()}</span>
                  </div>
                  <input type="range" min={minRaise} max={myPlayer?.chips ?? minRaise} step={game.bigBlind}
                    value={raiseAmount || minRaise}
                    onChange={(e) => setRaiseAmount(Number(e.target.value))}
                    className="w-full accent-yellow-500" />
                  <div className="flex gap-2 flex-wrap">
                    {halfPot <= (myPlayer?.chips ?? 0) && (
                      <button onClick={() => setRaiseAmount(halfPot)}
                        className="flex-1 py-1 text-xs rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition">
                        ½ Pot ({halfPot.toLocaleString()})
                      </button>
                    )}
                    {fullPot <= (myPlayer?.chips ?? 0) && fullPot !== halfPot && (
                      <button onClick={() => setRaiseAmount(fullPot)}
                        className="flex-1 py-1 text-xs rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition">
                        Pot ({fullPot.toLocaleString()})
                      </button>
                    )}
                    {[2, 3].map((mult) => {
                      const amt = (game.currentBet ?? 0) * mult;
                      if (!myPlayer || amt > myPlayer.chips || amt < minRaise || amt === fullPot || amt === halfPot) return null;
                      return (
                        <button key={mult} onClick={() => setRaiseAmount(amt)}
                          className="flex-1 py-1 text-xs rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition">
                          {mult}× ({amt.toLocaleString()})
                        </button>
                      );
                    })}
                    <button onClick={() => setRaiseAmount(myPlayer?.chips ?? 0)}
                      className="flex-1 py-1 text-xs rounded-lg bg-red-900 hover:bg-red-800 text-white font-bold transition">
                      All-In
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-3 w-full">
              <button onClick={() => act('fold')}
                className="flex-1 py-3.5 rounded-xl bg-red-900 hover:bg-red-800 border border-red-800 text-white font-bold text-sm transition active:scale-95">
                Fold
              </button>
              {canCheck ? (
                <button onClick={() => act('check')}
                  className="flex-1 py-3.5 rounded-xl bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white font-bold text-sm transition active:scale-95">
                  Check
                </button>
              ) : (
                <button onClick={() => act('call')}
                  className="flex-1 py-3.5 rounded-xl bg-green-800 hover:bg-green-700 border border-green-700 text-white font-bold text-sm transition active:scale-95">
                  Call {callAmount.toLocaleString()}
                </button>
              )}
              <button
                onClick={showRaise ? () => act('raise', raiseAmount || minRaise) : () => { setShowRaise(true); setRaiseAmount(minRaise); }}
                className="flex-1 py-3.5 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-black font-bold text-sm transition active:scale-95">
                {showRaise ? `Raise ${(raiseAmount || minRaise).toLocaleString()}` : 'Raise'}
              </button>
            </div>
          </div>
        )}

        {/* Pre-action presets (shown when waiting for your turn) */}
        {game.status === 'playing' && !isMyTurn && !myPlayer?.folded && (
          <div className="flex items-center justify-center gap-2 max-w-lg mx-auto">
            <span className="text-[11px] text-gray-600 font-medium">Pre-select:</span>
            {([
              { key: 'fold', label: 'Fold' },
              { key: 'check-or-fold', label: 'Check / Fold' },
              { key: 'call-any', label: 'Call Any' },
            ] as { key: PreAction; label: string }[]).map(({ key, label }) => (
              <button
                key={key!}
                onClick={() => setPreAction(preAction === key ? null : key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  preAction === key
                    ? 'bg-yellow-500 border-yellow-400 text-black'
                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {myPlayer && (
          <div className="mt-2 flex items-center justify-center gap-4 text-xs text-gray-500 flex-wrap">
            <span>Your chips: <span className="text-white font-mono">{myPlayer.chips?.toLocaleString()}</span></span>
            {myPlayer.folded && <span className="text-red-400">Folded — waiting for next hand</span>}
            {myPlayer.allIn && <span className="text-yellow-400">All-In</span>}
            {(myPlayer.rebuys ?? 0) > 0 && (
              <span className="text-purple-400">{myPlayer.rebuys} rebuy{(myPlayer.rebuys ?? 0) > 1 ? 's' : ''}</span>
            )}
            {(myPlayer.chips === 0 || myPlayer.allIn) && game.status === 'playing' && (
              <button
                onClick={() => socketRef.current.emit('rebuy', { tableId }, (state: GameState) => { if (state) setGame(state); })}
                className="px-3 py-1 rounded-lg bg-purple-700 hover:bg-purple-600 text-white font-bold transition">
                Rebuy +20,000
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TimerRing({ timeLeft }: { timeLeft: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const color = timeLeft > 20 ? '#22c55e' : timeLeft > 10 ? '#eab308' : '#ef4444';
  return (
    <svg className="absolute pointer-events-none" viewBox="0 0 48 48"
      style={{ inset: '-8px', width: 'calc(100% + 16px)', height: 'calc(100% + 16px)' }}>
      <circle cx="24" cy="24" r={r} fill="none" stroke="#ffffff18" strokeWidth="2.5" />
      <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - timeLeft / TURN_SECONDS)}
        style={{ transform: 'rotate(-90deg)', transformOrigin: '24px 24px', transition: 'stroke-dashoffset 0.6s linear, stroke 0.5s' }}
      />
    </svg>
  );
}

function SeatCard({ player, isActive, isMe, isDealer, isSB, isBB, timeLeft }: {
  player: PlayerState; isActive: boolean; isMe: boolean;
  isDealer: boolean; isSB: boolean; isBB: boolean; timeLeft: number | null;
}) {
  return (
    <div className={`flex flex-col items-center gap-0.5 transition-opacity ${player.folded ? 'opacity-40' : 'opacity-100'}`}>
      <AnimatePresence>
        {player.lastAction && !player.folded && (
          <motion.div key={player.lastAction} initial={{ opacity: 0, y: -4, scale: 0.85 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
            className="text-[9px] font-bold px-2 py-0.5 rounded-full mb-0.5 bg-black/70 text-gray-200 border border-gray-700 whitespace-nowrap">
            {player.lastAction}
          </motion.div>
        )}
      </AnimatePresence>

      {(player.holeCards?.length ?? 0) > 0 && (
        <div className="flex gap-0.5 mb-0.5">
          {player.holeCards.map((card, i) =>
            isMe
              ? <PlayingCard key={i} card={card} small delay={i * 0.06} />
              : <PlayingCard key={i} faceDown small delay={i * 0.06} />
          )}
        </div>
      )}

      <div className="relative">
        {isActive && timeLeft !== null && <TimerRing timeLeft={timeLeft} />}
        {isActive && (
          <motion.div className="absolute -inset-1.5 rounded-full border-2 border-yellow-400"
            style={{ boxShadow: '0 0 14px rgba(250,204,21,0.55)' }}
            animate={{ opacity: [1, 0.2, 1], scale: [1, 1.08, 1] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }} />
        )}
        <Avatar
          name={player.name} avatarUrl={player.avatarUrl}
          avatarStyle={player.avatarStyle as AvatarStyle | undefined}
          size="sm" isActive={isActive} isFolded={player.folded}
        />
        {isActive && timeLeft !== null && timeLeft <= 10 && (
          <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.5, repeat: Infinity }}
            className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center text-white ${
              timeLeft <= 5 ? 'bg-red-500' : 'bg-yellow-500'
            }`}>
            {timeLeft}
          </motion.div>
        )}
        <div className="absolute -top-1 -right-1 flex gap-0.5">
          {isDealer && <span className="text-[8px] bg-white text-black rounded-full w-3.5 h-3.5 flex items-center justify-center font-black">D</span>}
          {isSB && <span className="text-[8px] bg-blue-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center font-black">S</span>}
          {isBB && <span className="text-[8px] bg-red-600 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center font-black">B</span>}
        </div>
      </div>

      <div className={`text-center bg-black/65 rounded-lg px-2 py-0.5 mt-0.5 ${
        isActive ? 'ring-1 ring-yellow-400/60' : isMe ? 'ring-1 ring-blue-500/50' : ''
      }`}>
        <div className={`text-[11px] font-semibold leading-tight max-w-[76px] truncate ${isMe ? 'text-blue-300' : 'text-white'}`}>
          {player.name}{isMe ? ' (You)' : ''}
        </div>
        <div className="text-[10px] text-gray-400 font-mono">{player.chips?.toLocaleString()}</div>
        {player.allIn && <div className="text-[9px] text-yellow-400 font-bold">ALL IN</div>}
        {player.folded && <div className="text-[9px] text-red-400">Folded</div>}
        {!player.connected && <div className="text-[9px] text-gray-600">Away</div>}
      </div>
    </div>
  );
}
