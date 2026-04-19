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
  return { left: `${50 + 25 * Math.cos(rad)}%`, top: `${50 - 19 * Math.sin(rad)}%` };
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
      setChatOpen((open) => { if (!open) setUnread((u) => u + 1); return open; });
    });
    return () => {
      socket.off('game_state');
      socket.off('chat_message');
      socket.emit('leave_table', { tableId });
      leaveVoice();
    };
  }, [tableId, user]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (chatOpen) setUnread(0); }, [chatOpen]);

  const game = currentGame;

  useEffect(() => {
    if (!game?.turnExpiresAt || game.status !== 'playing') { setTimeLeft(TURN_SECONDS); return; }
    const tick = () => setTimeLeft(Math.max(0, Math.ceil((game.turnExpiresAt! - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [game?.turnExpiresAt, game?.status]);

  useEffect(() => {
    if (game?.round && game.round !== prevRoundRef.current) {
      setPreAction(null);
      prevRoundRef.current = game.round;
    }
  }, [game?.round]);

  const isMyTurn = game?.status === 'playing' && game.players?.[game.activePlayerIndex]?.id === user?.id;
  const myIdx = game?.players?.findIndex((p) => p.id === user?.id) ?? -1;
  const myPlayer = myIdx >= 0 ? game?.players[myIdx] : null;
  const canCheck = isMyTurn && game?.currentBet === (myPlayer?.bet ?? 0);

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
    socketRef.current.emit('start_game', { tableId }, (state: GameState) => { if (state) setGame(state); });
  }
  function act(action: string, raise?: number) {
    socketRef.current.emit('player_action', { tableId, action, raiseAmount: raise }, (state: GameState) => { if (state) setGame(state); });
    setShowRaise(false);
  }
  function sendChat() {
    const msg = chatInput.trim();
    if (!msg || !tableId) return;
    socketRef.current.emit('chat_message', { tableId, message: msg });
    setChatInput('');
  }

  if (!game) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#050507' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="shimmer-text font-display" style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>♦ HALAL POKER</div>
        <div style={{ color: 'rgba(201,160,96,0.5)', fontSize: 13 }}>Connecting to table…</div>
      </div>
    </div>
  );

  const effectiveMyIdx = myIdx >= 0 ? myIdx : 0;
  const callAmount = Math.max(0, (game.currentBet ?? 0) - (myPlayer?.bet ?? 0));
  const minRaise = game.minRaise ?? game.bigBlind;
  const n = game.players?.length ?? 1;
  const sbIdx = (game.dealerIndex + 1) % n;
  const bbIdx = (game.dealerIndex + 2) % n;

  const handStrength = (myPlayer?.holeCards?.length ?? 0) >= 2 && game.status === 'playing'
    ? evaluateHandRank([...(myPlayer?.holeCards ?? []), ...(game.communityCards ?? [])])
    : null;

  const halfPot = Math.max(minRaise, Math.round((game.pot / 2) / (game.bigBlind || 1)) * (game.bigBlind || 1));
  const fullPot = Math.max(minRaise, Math.round(game.pot / (game.bigBlind || 1)) * (game.bigBlind || 1));

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at center top, #0a0a12, #050507 60%)', display: 'flex', flexDirection: 'column' }} className="select-none">

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px',
        borderBottom: '1px solid rgba(201,160,96,0.12)',
        background: 'rgba(4,4,8,0.9)',
        backdropFilter: 'blur(20px)',
        flexShrink: 0,
      }}>
        <button onClick={() => nav('/lobby')} style={{
          color: 'rgba(201,160,96,0.5)', background: 'none', border: 'none',
          cursor: 'pointer', fontSize: 13, transition: 'color 0.2s',
        }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(201,160,96,0.9)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(201,160,96,0.5)')}
        >
          ← The Lobby
        </button>

        <div style={{ textAlign: 'center' }}>
          <div className="font-display" style={{
            fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'rgba(201,160,96,0.5)', fontWeight: 400,
          }}>
            {ROUND_LABELS[game.round] ?? game.round}
          </div>
          {game.pot > 0 && (
            <div style={{ color: '#e8c97a', fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 700 }}>
              {game.pot.toLocaleString()} <span style={{ fontSize: 10, opacity: 0.6, fontFamily: 'Inter, sans-serif', fontWeight: 400 }}>in pot</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Chat button */}
          <button onClick={() => setChatOpen((o) => !o)} style={{
            position: 'relative', padding: 8, borderRadius: 8, border: '1px solid rgba(201,160,96,0.15)',
            background: 'rgba(201,160,96,0.05)', color: 'rgba(201,160,96,0.6)', cursor: 'pointer', transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(201,160,96,0.1)'; e.currentTarget.style.color = 'rgba(201,160,96,1)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(201,160,96,0.05)'; e.currentTarget.style.color = 'rgba(201,160,96,0.6)'; }}
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {unread > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%',
                background: 'linear-gradient(135deg, #c9a060, #e8c97a)', color: '#000', fontSize: 9, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          <VoiceChat active={active} muted={muted} peers={peers} error={voiceError}
            onJoin={joinVoice} onLeave={leaveVoice} onToggleMute={toggleMute} />
        </div>
      </div>

      {/* Table area */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, minHeight: 0 }}>
        <div style={{
          position: 'relative',
          width: 'min(100%, calc((100vh - 240px) * 3 / 2))',
          aspectRatio: '3/2',
        }}>
          {/* Outer shadow/glow */}
          <div style={{
            position: 'absolute', inset: -20,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(201,160,96,0.06) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* Mahogany wood rail */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'radial-gradient(ellipse at 30% 25%, #4a2008, #2a1005 40%, #1a0803 70%, #2a1005)',
            boxShadow: '0 20px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(201,160,96,0.1), inset 0 0 40px rgba(0,0,0,0.5)',
          }} />

          {/* Gold trim ring */}
          <div style={{
            position: 'absolute', inset: 8, borderRadius: '50%',
            background: 'linear-gradient(135deg, #c9a060 0%, #6b4a20 25%, #c9a060 50%, #e8c97a 75%, #c9a060 100%)',
          }} />

          {/* Felt surface */}
          <div style={{
            position: 'absolute', inset: 12, borderRadius: '50%',
            background: 'radial-gradient(ellipse at 50% 35%, #1a5c35 0%, #0f4028 45%, #072a18 100%)',
          }} />

          {/* Felt inner shadow for depth */}
          <div style={{
            position: 'absolute', inset: 12, borderRadius: '50%',
            boxShadow: 'inset 0 0 80px rgba(0,0,0,0.45), inset 0 0 25px rgba(0,0,0,0.3)',
            pointerEvents: 'none',
          }} />

          {/* Subtle felt logo */}
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none', zIndex: 1,
          }}>
            <span style={{ fontSize: 90, color: 'rgba(255,255,255,0.025)', fontFamily: 'Georgia, serif', userSelect: 'none' }}>♦</span>
          </div>

          {/* Center content: pot + cards + hand strength */}
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8, zIndex: 10, pointerEvents: 'none',
          }}>
            <AnimatePresence mode="wait">
              {game.pot > 0 && (
                <motion.div key={game.pot} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: 'rgba(0,0,0,0.55)', borderRadius: 100,
                    padding: '4px 14px 4px 10px',
                    border: '1px solid rgba(201,160,96,0.2)',
                    backdropFilter: 'blur(8px)',
                    marginBottom: 4,
                  }}>
                  {/* Chip icon */}
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, #c9a060, #8c6a30)',
                    boxShadow: '0 0 6px rgba(201,160,96,0.5)',
                  }} />
                  <span style={{ color: '#e8c97a', fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700 }}>
                    {game.pot.toLocaleString()}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Community cards */}
            <div style={{ display: 'flex', gap: 6 }}>
              <AnimatePresence>
                {(game.communityCards ?? []).map((card, i) => (
                  <motion.div key={`${card.rank}${card.suit}`}
                    initial={{ y: -30, opacity: 0, scale: 0.7 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.12, type: 'spring', stiffness: 280, damping: 22 }}>
                    <PlayingCard card={card} small />
                  </motion.div>
                ))}
              </AnimatePresence>
              {!(game.communityCards ?? []).length && game.status === 'waiting' && (
                <span style={{ color: 'rgba(201,160,96,0.3)', fontSize: 11, fontStyle: 'italic' }}>Awaiting deal…</span>
              )}
            </div>

            {/* Hand strength */}
            {handStrength && (
              <motion.div key={handStrength} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                style={{
                  marginTop: 4,
                  background: 'rgba(0,0,0,0.7)',
                  border: '1px solid rgba(201,160,96,0.3)',
                  borderRadius: 100, padding: '3px 12px',
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                  color: '#e8c97a', textTransform: 'uppercase',
                }}>
                {handStrength}
              </motion.div>
            )}
          </div>

          {/* Winner overlay */}
          <AnimatePresence>
            {game.status === 'finished' && game.winnerId && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{
                  position: 'absolute', inset: 12, borderRadius: '50%', zIndex: 30,
                  background: 'rgba(5,5,7,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backdropFilter: 'blur(4px)',
                }}>
                <motion.div initial={{ scale: 0.5, y: 20 }} animate={{ scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 42, marginBottom: 8 }}>♛</div>
                  <div className="font-display shimmer-text" style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
                    {game.players?.find((p) => p.id === game.winnerId)?.name}
                  </div>
                  <div style={{ color: 'rgba(232,220,200,0.5)', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
                    {game.handRank}
                  </div>
                  <div style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 700,
                    color: '#4ade80',
                  }}>
                    +{game.winnerAmount?.toLocaleString()}
                  </div>
                  {game.players?.find((p) => p.id === game.winnerId)?.id === user?.id && (
                    <div style={{ marginTop: 8, fontSize: 12, color: '#e8c97a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      You won the hand
                    </div>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bet tokens */}
          {game.players?.map((player, i) =>
            player.bet > 0 ? (
              <motion.div key={`bet-${player.id}`} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                style={{
                  position: 'absolute', zIndex: 20,
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                  ...getBetStyle(i, n, effectiveMyIdx),
                }}>
                <div style={{
                  background: 'linear-gradient(135deg, #c9a060, #8c6a30)',
                  color: '#1a0f00', fontSize: 10, fontWeight: 800,
                  padding: '2px 8px', borderRadius: 100,
                  boxShadow: '0 2px 8px rgba(201,160,96,0.4), 0 0 0 1px rgba(232,201,122,0.3)',
                  fontFamily: 'JetBrains Mono, monospace',
                  whiteSpace: 'nowrap',
                }}>
                  {player.bet.toLocaleString()}
                </div>
              </motion.div>
            ) : null
          )}

          {/* Player seats */}
          {game.players?.map((player, i) => (
            <div key={player.id} style={{
              position: 'absolute', zIndex: 20,
              transform: 'translate(-50%, -50%)',
              ...getSeatStyle(i, n, effectiveMyIdx),
            }}>
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

      {/* Action bar */}
      <div style={{ flexShrink: 0, padding: '8px 20px 24px' }}>

        {game.status === 'waiting' && n >= 2 && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button onClick={startGame} style={{
              padding: '14px 40px', borderRadius: 12, cursor: 'pointer',
              background: 'linear-gradient(180deg, #e8c97a 0%, #c9a060 100%)',
              border: '1px solid #d4b070', color: '#1a0f00',
              fontWeight: 700, fontSize: 15, letterSpacing: '0.05em',
              boxShadow: '0 4px 24px rgba(201,160,96,0.35), 0 1px 0 rgba(255,255,255,0.2) inset',
              transition: 'all 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 6px 32px rgba(201,160,96,0.55), 0 1px 0 rgba(255,255,255,0.2) inset')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 4px 24px rgba(201,160,96,0.35), 0 1px 0 rgba(255,255,255,0.2) inset')}
            >
              Deal Cards
            </button>
          </div>
        )}

        {isMyTurn && !myPlayer?.folded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 480, margin: '0 auto' }}>
            {/* Timer bar */}
            <div style={{ height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <motion.div style={{
                height: '100%', borderRadius: 2,
                background: timeLeft > 20 ? 'linear-gradient(90deg, #22c55e, #4ade80)' :
                  timeLeft > 10 ? 'linear-gradient(90deg, #c9a060, #e8c97a)' :
                    'linear-gradient(90deg, #dc2626, #ef4444)',
                width: `${(timeLeft / TURN_SECONDS) * 100}%`,
                transition: 'background 0.5s',
              }} />
            </div>

            {/* Raise panel */}
            <AnimatePresence>
              {showRaise && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                  style={{
                    background: 'rgba(8,8,14,0.95)', border: '1px solid rgba(201,160,96,0.15)',
                    borderRadius: 14, padding: 14, backdropFilter: 'blur(20px)',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: 'rgba(201,160,96,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Raise to</span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 15, fontWeight: 700, color: '#e8c97a' }}>
                      {(raiseAmount || minRaise).toLocaleString()}
                    </span>
                  </div>
                  <input type="range" min={minRaise} max={myPlayer?.chips ?? minRaise}
                    step={game.bigBlind} value={raiseAmount || minRaise}
                    onChange={(e) => setRaiseAmount(Number(e.target.value))}
                    style={{ width: '100%', marginBottom: 10, accentColor: '#c9a060' }} />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {halfPot <= (myPlayer?.chips ?? 0) && (
                      <PresetBtn label={`½ Pot · ${halfPot.toLocaleString()}`} onClick={() => setRaiseAmount(halfPot)} />
                    )}
                    {fullPot <= (myPlayer?.chips ?? 0) && fullPot !== halfPot && (
                      <PresetBtn label={`Pot · ${fullPot.toLocaleString()}`} onClick={() => setRaiseAmount(fullPot)} />
                    )}
                    {[2, 3].map((mult) => {
                      const amt = (game.currentBet ?? 0) * mult;
                      if (!myPlayer || amt > myPlayer.chips || amt < minRaise || amt === fullPot || amt === halfPot) return null;
                      return <PresetBtn key={mult} label={`${mult}× · ${amt.toLocaleString()}`} onClick={() => setRaiseAmount(amt)} />;
                    })}
                    <button onClick={() => setRaiseAmount(myPlayer?.chips ?? 0)} style={{
                      flex: 1, padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                      background: 'rgba(120,0,0,0.4)', border: '1px solid rgba(180,0,0,0.4)', color: '#fca5a5',
                    }}>
                      All-In
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <ActionBtn
                label="Fold"
                onClick={() => act('fold')}
                style={{
                  background: 'linear-gradient(180deg, #4a1010 0%, #2a0808 100%)',
                  border: '1px solid rgba(120,30,30,0.6)',
                  color: '#fca5a5',
                  boxShadow: '0 4px 16px rgba(80,0,0,0.3)',
                }}
                hoverShadow="0 6px 24px rgba(120,0,0,0.45)"
              />
              {canCheck ? (
                <ActionBtn
                  label="Check"
                  onClick={() => act('check')}
                  style={{
                    background: 'linear-gradient(180deg, #1a3d2a 0%, #0d2418 100%)',
                    border: '1px solid rgba(30,90,50,0.6)',
                    color: '#86efac',
                    boxShadow: '0 4px 16px rgba(0,60,30,0.3)',
                  }}
                  hoverShadow="0 6px 24px rgba(0,100,50,0.4)"
                />
              ) : (
                <ActionBtn
                  label={`Call  ${callAmount.toLocaleString()}`}
                  onClick={() => act('call')}
                  style={{
                    background: 'linear-gradient(180deg, #1a4a2a 0%, #0d3018 100%)',
                    border: '1px solid rgba(30,100,60,0.6)',
                    color: '#86efac',
                    boxShadow: '0 4px 16px rgba(0,80,40,0.35)',
                  }}
                  hoverShadow="0 6px 24px rgba(0,120,60,0.45)"
                />
              )}
              <ActionBtn
                label={showRaise ? `Raise  ${(raiseAmount || minRaise).toLocaleString()}` : 'Raise'}
                onClick={showRaise ? () => act('raise', raiseAmount || minRaise) : () => { setShowRaise(true); setRaiseAmount(minRaise); }}
                style={{
                  background: 'linear-gradient(180deg, #e8c97a 0%, #c9a060 100%)',
                  border: '1px solid #d4b070',
                  color: '#1a0f00',
                  boxShadow: '0 4px 20px rgba(201,160,96,0.35), 0 1px 0 rgba(255,255,255,0.25) inset',
                  fontWeight: 800,
                }}
                hoverShadow="0 6px 28px rgba(201,160,96,0.55)"
              />
            </div>
          </div>
        )}

        {/* Pre-action presets */}
        {game.status === 'playing' && !isMyTurn && !myPlayer?.folded && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 }}>
            <span style={{ fontSize: 10, color: 'rgba(201,160,96,0.35)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Pre-select</span>
            {([
              { key: 'fold', label: 'Fold' },
              { key: 'check-or-fold', label: 'Check / Fold' },
              { key: 'call-any', label: 'Call Any' },
            ] as { key: PreAction; label: string }[]).map(({ key, label }) => (
              <button key={key!} onClick={() => setPreAction(preAction === key ? null : key)}
                style={{
                  padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, transition: 'all 0.2s',
                  background: preAction === key ? 'rgba(201,160,96,0.15)' : 'transparent',
                  border: preAction === key ? '1px solid rgba(201,160,96,0.5)' : '1px solid rgba(201,160,96,0.12)',
                  color: preAction === key ? '#e8c97a' : 'rgba(201,160,96,0.35)',
                }}>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Status row */}
        {myPlayer && (
          <div style={{
            marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
            fontSize: 11, color: 'rgba(232,220,200,0.3)',
          }}>
            <span>
              Stack: <span style={{ color: '#e8dcc8', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                {myPlayer.chips?.toLocaleString()}
              </span>
            </span>
            {myPlayer.folded && <span style={{ color: '#f87171' }}>Folded</span>}
            {myPlayer.allIn && <span style={{ color: '#e8c97a' }}>All-In</span>}
            {(myPlayer.rebuys ?? 0) > 0 && <span style={{ color: '#c084fc' }}>{myPlayer.rebuys} rebuy{(myPlayer.rebuys ?? 0) > 1 ? 's' : ''}</span>}
            {(myPlayer.chips === 0 || myPlayer.allIn) && game.status === 'playing' && (
              <button onClick={() => socketRef.current.emit('rebuy', { tableId }, (state: GameState) => { if (state) setGame(state); })}
                style={{
                  padding: '4px 12px', borderRadius: 8, cursor: 'pointer',
                  background: 'rgba(147,51,234,0.2)', border: '1px solid rgba(147,51,234,0.4)',
                  color: '#c084fc', fontSize: 11, fontWeight: 700,
                }}>
                Rebuy +20,000
              </button>
            )}
          </div>
        )}
      </div>

      {/* Chat overlay */}
      <AnimatePresence>
        {chatOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
              onClick={() => setChatOpen(false)} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              style={{
                position: 'fixed', right: 0, top: 0, bottom: 0, width: 280, zIndex: 50,
                background: 'rgba(6,6,10,0.97)', borderLeft: '1px solid rgba(201,160,96,0.12)',
                display: 'flex', flexDirection: 'column', backdropFilter: 'blur(20px)',
              }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(201,160,96,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="font-display" style={{ fontSize: 16, fontWeight: 600, color: '#e8dcc8', letterSpacing: '0.03em' }}>Table Chat</span>
                <button onClick={() => setChatOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(201,160,96,0.4)', cursor: 'pointer', fontSize: 18 }}>✕</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {messages.length === 0 && (
                  <p style={{ color: 'rgba(201,160,96,0.25)', fontSize: 12, textAlign: 'center', marginTop: 20 }}>No messages yet.</p>
                )}
                {messages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: msg.userId === user?.id ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-start' }}>
                    <Avatar name={msg.name} avatarUrl={msg.avatarUrl} avatarStyle={msg.avatarStyle as AvatarStyle | undefined} size="sm" />
                    <div style={{ maxWidth: 180, display: 'flex', flexDirection: 'column', alignItems: msg.userId === user?.id ? 'flex-end' : 'flex-start' }}>
                      <span style={{ fontSize: 10, color: 'rgba(201,160,96,0.4)', marginBottom: 3 }}>{msg.name}</span>
                      <div style={{
                        padding: '7px 12px', borderRadius: 12, fontSize: 13, wordBreak: 'break-word',
                        background: msg.userId === user?.id ? 'rgba(201,160,96,0.15)' : 'rgba(255,255,255,0.05)',
                        border: msg.userId === user?.id ? '1px solid rgba(201,160,96,0.25)' : '1px solid rgba(255,255,255,0.06)',
                        color: msg.userId === user?.id ? '#e8c97a' : '#e8dcc8',
                        borderTopRightRadius: msg.userId === user?.id ? 4 : 12,
                        borderTopLeftRadius: msg.userId === user?.id ? 12 : 4,
                      }}>
                        {msg.message}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div style={{ padding: 12, borderTop: '1px solid rgba(201,160,96,0.1)' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') sendChat(); }}
                    placeholder="Message…" maxLength={300} autoFocus
                    style={{
                      flex: 1, padding: '8px 12px', borderRadius: 10, fontSize: 13,
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,160,96,0.15)',
                      color: '#e8dcc8', outline: 'none',
                    }} />
                  <button onClick={sendChat} disabled={!chatInput.trim()} style={{
                    padding: '8px 12px', borderRadius: 10, cursor: chatInput.trim() ? 'pointer' : 'default',
                    background: chatInput.trim() ? 'linear-gradient(135deg, #c9a060, #8c6a30)' : 'rgba(255,255,255,0.04)',
                    border: 'none', color: chatInput.trim() ? '#1a0f00' : 'rgba(255,255,255,0.2)',
                    fontWeight: 700, fontSize: 14, transition: 'all 0.2s',
                  }}>↑</button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function PresetBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '6px 8px', borderRadius: 8, cursor: 'pointer',
      fontSize: 11, fontWeight: 600, transition: 'all 0.2s',
      background: 'rgba(201,160,96,0.08)', border: '1px solid rgba(201,160,96,0.2)',
      color: 'rgba(232,201,122,0.8)',
    }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(201,160,96,0.15)'; e.currentTarget.style.color = '#e8c97a'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(201,160,96,0.08)'; e.currentTarget.style.color = 'rgba(232,201,122,0.8)'; }}
    >
      {label}
    </button>
  );
}

function ActionBtn({ label, onClick, style, hoverShadow }: {
  label: string; onClick: () => void;
  style: React.CSSProperties; hoverShadow: string;
}) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '14px 10px', borderRadius: 12, cursor: 'pointer',
      fontSize: 13, fontWeight: 700, letterSpacing: '0.03em',
      transition: 'all 0.18s', textAlign: 'center', ...style,
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = hoverShadow; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = style.boxShadow as string ?? ''; e.currentTarget.style.transform = ''; }}
      onMouseDown={e => { e.currentTarget.style.transform = 'translateY(1px)'; }}
      onMouseUp={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
    >
      {label}
    </button>
  );
}

function TimerRing({ timeLeft }: { timeLeft: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const color = timeLeft > 20 ? '#22c55e' : timeLeft > 10 ? '#c9a060' : '#ef4444';
  return (
    <svg style={{ position: 'absolute', inset: -8, width: 'calc(100% + 16px)', height: 'calc(100% + 16px)', pointerEvents: 'none' }} viewBox="0 0 48 48">
      <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
      <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - timeLeft / TURN_SECONDS)}
        style={{ transform: 'rotate(-90deg)', transformOrigin: '24px 24px', transition: 'stroke-dashoffset 0.6s linear, stroke 0.5s' }} />
    </svg>
  );
}

function SeatCard({ player, isActive, isMe, isDealer, isSB, isBB, timeLeft }: {
  player: PlayerState; isActive: boolean; isMe: boolean;
  isDealer: boolean; isSB: boolean; isBB: boolean; timeLeft: number | null;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, opacity: player.folded ? 0.4 : 1, transition: 'opacity 0.3s' }}>

      {/* Last action badge */}
      <AnimatePresence>
        {player.lastAction && !player.folded && (
          <motion.div key={player.lastAction} initial={{ opacity: 0, y: -6, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            style={{
              fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
              background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(201,160,96,0.2)',
              color: 'rgba(232,201,122,0.8)', whiteSpace: 'nowrap', letterSpacing: '0.05em',
              backdropFilter: 'blur(8px)',
            }}>
            {player.lastAction}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hole cards */}
      {(player.holeCards?.length ?? 0) > 0 && (
        <div style={{ display: 'flex', gap: 3, marginBottom: 2 }}>
          {player.holeCards.map((card, i) =>
            isMe
              ? <PlayingCard key={i} card={card} small delay={i * 0.07} />
              : <PlayingCard key={i} faceDown small delay={i * 0.07} />
          )}
        </div>
      )}

      {/* Avatar with timer ring */}
      <div style={{ position: 'relative' }}>
        {isActive && timeLeft !== null && <TimerRing timeLeft={timeLeft} />}
        {isActive && (
          <motion.div style={{
            position: 'absolute', inset: -6, borderRadius: '50%',
            border: '2px solid rgba(201,160,96,0.7)',
            boxShadow: '0 0 16px rgba(201,160,96,0.5), 0 0 32px rgba(201,160,96,0.2)',
          }}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }} />
        )}
        <div style={{
          padding: 1.5,
          borderRadius: '50%',
          background: isMe
            ? 'linear-gradient(135deg, #4a80e0, #2a50a0)'
            : isActive
              ? 'linear-gradient(135deg, #c9a060, #8c6a30)'
              : 'rgba(255,255,255,0.08)',
        }}>
          <Avatar name={player.name} avatarUrl={player.avatarUrl}
            avatarStyle={player.avatarStyle as AvatarStyle | undefined}
            size="sm" isActive={isActive} isFolded={player.folded} />
        </div>

        {/* Timer number badge */}
        {isActive && timeLeft !== null && timeLeft <= 10 && (
          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.4, repeat: Infinity }}
            style={{
              position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: timeLeft <= 5 ? '#dc2626' : '#c9a060',
              fontSize: 9, fontWeight: 900, color: '#fff',
            }}>
            {timeLeft}
          </motion.div>
        )}

        {/* Position badges */}
        <div style={{ position: 'absolute', top: -2, right: -2, display: 'flex', gap: 1 }}>
          {isDealer && <Badge label="D" bg="#f0f0f0" color="#000" />}
          {isSB && <Badge label="S" bg="#3b82f6" color="#fff" />}
          {isBB && <Badge label="B" bg="#dc2626" color="#fff" />}
        </div>
      </div>

      {/* Name chip */}
      <div style={{
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        border: isActive ? '1px solid rgba(201,160,96,0.4)' : isMe ? '1px solid rgba(74,128,224,0.3)' : '1px solid rgba(255,255,255,0.06)',
        borderRadius: 8, padding: '3px 8px', textAlign: 'center', marginTop: 2,
        boxShadow: isActive ? '0 0 10px rgba(201,160,96,0.15)' : 'none',
      }}>
        <div style={{ fontSize: 10, fontWeight: 600, maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isMe ? '#93c5fd' : '#e8dcc8' }}>
          {player.name}
        </div>
        <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: 'rgba(201,160,96,0.7)', fontWeight: 700 }}>
          {player.chips?.toLocaleString()}
        </div>
        {player.allIn && <div style={{ fontSize: 8, color: '#e8c97a', fontWeight: 800, letterSpacing: '0.05em' }}>ALL-IN</div>}
        {!player.connected && <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>Away</div>}
      </div>
    </div>
  );
}

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{
      fontSize: 7, background: bg, color, borderRadius: '50%', width: 13, height: 13,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900,
    }}>{label}</span>
  );
}
