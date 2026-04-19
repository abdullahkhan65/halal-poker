import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { connectSocket } from '../lib/socket';
import { useGameStore, GameState, PlayerState } from '../store/game.store';
import { useAuthStore } from '../store/auth.store';
import { PlayingCard } from '../components/PlayingCard';
import { Avatar } from '../components/Avatar';
import { VoiceChat } from '../components/VoiceChat';
import { useVoiceChat } from '../hooks/useVoiceChat';

const ROUND_LABELS: Record<string, string> = {
  preflop: 'Pre-Flop', flop: 'Flop', turn: 'Turn', river: 'River', showdown: 'Showdown',
};

export function TablePage() {
  const { tableId } = useParams<{ tableId: string }>();
  const nav = useNavigate();
  const { currentGame, setGame } = useGameStore();
  const user = useAuthStore((s) => s.user);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [showRaise, setShowRaise] = useState(false);
  const socketRef = useRef(connectSocket());

  const { peers, muted, active, error: voiceError, join: joinVoice, leave: leaveVoice, toggleMute } =
    useVoiceChat(socketRef.current, tableId ?? null, user?.id ?? null);

  useEffect(() => {
    if (!tableId || !user) return;
    const socket = socketRef.current;
    socket.emit('join_table', { tableId, chips: 20000 }, (state: GameState) => {
      if (state) setGame(state);
    });
    socket.on('game_state', (state: GameState) => setGame(state));
    return () => {
      socket.off('game_state');
      socket.emit('leave_table', { tableId });
      leaveVoice();
    };
  }, [tableId, user]);

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

  const game = currentGame;
  if (!game) return <div className="flex justify-center items-center h-64 text-gray-400">Connecting to table...</div>;

  const myPlayer = game.players?.find((p) => p.id === user?.id);
  const isMyTurn = game.status === 'playing' && game.players?.[game.activePlayerIndex]?.id === user?.id;
  const canCheck = isMyTurn && game.currentBet === (myPlayer?.bet ?? 0);
  const callAmount = Math.max(0, (game.currentBet ?? 0) - (myPlayer?.bet ?? 0));

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <button onClick={() => nav('/lobby')} className="text-gray-500 hover:text-gray-300 text-sm transition">
            ← Back to Lobby
          </button>
          <div className="text-center">
            <span className="text-yellow-400 font-bold">{ROUND_LABELS[game.round] ?? game.round}</span>
            {game.pot > 0 && <span className="ml-3 text-gray-400 text-sm">Pot: <span className="text-white font-mono">{game.pot?.toLocaleString()}</span></span>}
          </div>
          <VoiceChat
            active={active}
            muted={muted}
            peers={peers}
            error={voiceError}
            onJoin={joinVoice}
            onLeave={leaveVoice}
            onToggleMute={toggleMute}
          />
        </div>

        {/* Felt */}
        <div className="relative rounded-[80px] bg-gradient-to-br from-[#1a4a2e] to-[#0f2d1c] border-4 border-[#0d3520] shadow-2xl p-8 min-h-[420px] flex flex-col items-center justify-center gap-6">

          {/* Community Cards */}
          <div className="flex gap-3 justify-center">
            {game.communityCards?.length > 0 ? (
              game.communityCards.map((card, i) => (
                <PlayingCard key={i} card={card} delay={i * 0.1} />
              ))
            ) : (
              <div className="text-gray-600 text-sm italic">
                {game.status === 'waiting' ? 'Waiting for players...' : 'Community cards will appear here'}
              </div>
            )}
          </div>

          {/* Winner announcement */}
          <AnimatePresence>
            {game.status === 'finished' && game.winnerId && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-[76px]"
              >
                <div className="text-center">
                  <div className="text-5xl mb-2">🏆</div>
                  <div className="text-2xl font-bold text-yellow-400">
                    {game.players?.find((p) => p.id === game.winnerId)?.name ?? 'Winner'}
                  </div>
                  <div className="text-gray-300 mt-1">{game.handRank}</div>
                  <div className="text-green-400 font-mono font-bold text-lg mt-1">
                    +{game.winnerAmount?.toLocaleString()}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Players around the table */}
          <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-3">
            {game.players?.map((player, i) => (
              <PlayerSeat
                key={player.id}
                player={player}
                isActive={i === game.activePlayerIndex && game.status === 'playing'}
                isMe={player.id === user?.id}
                dealerIndex={game.dealerIndex}
                seatIndex={i}
                totalPlayers={game.players.length}
              />
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="mt-4 flex flex-col items-center gap-3">
          {game.status === 'waiting' && game.players?.length >= 2 && (
            <button
              onClick={startGame}
              className="px-8 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-lg transition"
            >
              Start Game
            </button>
          )}

          {isMyTurn && !myPlayer?.folded && (
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={() => act('fold')}
                className="px-6 py-3 rounded-xl bg-red-800 hover:bg-red-700 text-white font-bold transition"
              >
                Fold
              </button>
              {canCheck ? (
                <button
                  onClick={() => act('check')}
                  className="px-6 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-bold transition"
                >
                  Check
                </button>
              ) : (
                <button
                  onClick={() => act('call')}
                  className="px-6 py-3 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-bold transition"
                >
                  Call {callAmount.toLocaleString()}
                </button>
              )}
              {showRaise ? (
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={raiseAmount || game.minRaise}
                    min={game.minRaise}
                    step={game.bigBlind}
                    onChange={(e) => setRaiseAmount(Number(e.target.value))}
                    className="w-28 px-3 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white font-mono text-sm focus:outline-none"
                  />
                  <button
                    onClick={() => act('raise', raiseAmount || game.minRaise)}
                    className="px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm transition"
                  >
                    Raise
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setShowRaise(true); setRaiseAmount(game.minRaise); }}
                  className="px-6 py-3 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-black font-bold transition"
                >
                  Raise
                </button>
              )}
            </div>
          )}

          {myPlayer && (
            <div className="flex items-center gap-4 flex-wrap justify-center">
              <div className="text-sm text-gray-400">
                Your chips: <span className="text-white font-mono font-bold">{myPlayer.chips?.toLocaleString()}</span>
                {myPlayer.folded && <span className="ml-2 text-red-400">(Folded)</span>}
                {myPlayer.allIn && <span className="ml-2 text-yellow-400">(All-In)</span>}
                {(myPlayer.rebuys ?? 0) > 0 && (
                  <span className="ml-2 text-purple-400 text-xs">{myPlayer.rebuys} rebuy{myPlayer.rebuys > 1 ? 's' : ''}</span>
                )}
              </div>
              {(myPlayer.chips === 0 || myPlayer.allIn) && game.status === 'playing' && (
                <button
                  onClick={() => socketRef.current.emit('rebuy', { tableId }, (state: GameState) => { if (state) setGame(state); })}
                  className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-bold text-sm transition"
                >
                  Rebuy +20,000
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerSeat({
  player, isActive, isMe, dealerIndex, seatIndex, totalPlayers,
}: {
  player: PlayerState; isActive: boolean; isMe: boolean;
  dealerIndex: number; seatIndex: number; totalPlayers: number;
}) {
  const isDealer = seatIndex === dealerIndex;
  const sbIdx = (dealerIndex + 1) % totalPlayers;
  const bbIdx = (dealerIndex + 2) % totalPlayers;

  return (
    <motion.div
      animate={{ opacity: player.folded ? 0.5 : 1 }}
      className={`relative p-3 rounded-xl border transition-all ${
        isActive ? 'border-yellow-400 bg-yellow-900/20 shadow-lg shadow-yellow-900/30'
          : isMe ? 'border-blue-600 bg-blue-900/20'
          : 'border-gray-800 bg-gray-900'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Avatar name={player.name} size="sm" isActive={isActive} isFolded={player.folded} />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-white truncate">
            {player.name} {isMe && <span className="text-blue-400">(You)</span>}
          </div>
          <div className="text-xs text-gray-400 font-mono">{player.chips?.toLocaleString()}</div>
        </div>
        <div className="flex gap-1 items-center">
          {isDealer && <span className="text-xs bg-white text-black rounded-full w-4 h-4 flex items-center justify-center font-bold">D</span>}
          {seatIndex === sbIdx && <span className="text-xs bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center font-bold">S</span>}
          {seatIndex === bbIdx && <span className="text-xs bg-red-700 text-white rounded-full w-4 h-4 flex items-center justify-center font-bold">B</span>}
        </div>
      </div>

      {player.holeCards?.length > 0 && (
        <div className="flex gap-1 justify-center">
          {player.holeCards.map((card, i) => (
            isMe
              ? <PlayingCard key={i} card={card} small delay={i * 0.1} />
              : <PlayingCard key={i} faceDown small delay={i * 0.1} />
          ))}
        </div>
      )}

      {player.bet > 0 && (
        <div className="mt-1 text-xs text-center text-yellow-300 font-mono">Bet: {player.bet.toLocaleString()}</div>
      )}
      {player.folded && <div className="text-xs text-center text-red-400 mt-1">Folded</div>}
      {player.allIn && <div className="text-xs text-center text-yellow-400 mt-1">All-In</div>}
      {!player.connected && <div className="text-xs text-center text-gray-600 mt-1">Disconnected</div>}
    </motion.div>
  );
}
