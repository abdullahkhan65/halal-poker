import { motion, AnimatePresence } from 'framer-motion';
import type { VoicePeer } from '../hooks/useVoiceChat';

interface Props {
  active: boolean;
  muted: boolean;
  peers: VoicePeer[];
  error: string | null;
  onJoin: () => void;
  onLeave: () => void;
  onToggleMute: () => void;
}

export function VoiceChat({ active, muted, peers, error, onJoin, onLeave, onToggleMute }: Props) {
  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-xs text-red-400 max-w-[140px] truncate" title={error}>
          {error}
        </span>
      )}

      {/* Peer avatars */}
      <AnimatePresence>
        {active && peers.map((peer) => (
          <motion.div
            key={peer.userId}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="relative flex items-center justify-center w-7 h-7 rounded-full bg-green-800 border border-green-500"
            title={peer.userName}
          >
            <span className="text-xs text-green-300 font-bold leading-none">
              {peer.userName.slice(0, 2).toUpperCase()}
            </span>
            {/* speaking pulse */}
            <span className="absolute inset-0 rounded-full animate-ping bg-green-500 opacity-20" />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Mute / unmute */}
      {active && (
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onToggleMute}
          className={`flex items-center justify-center w-9 h-9 rounded-full border transition-colors ${
            muted
              ? 'bg-red-900/60 border-red-600 text-red-400'
              : 'bg-green-900/60 border-green-600 text-green-400'
          }`}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? '🔇' : '🎙️'}
        </motion.button>
      )}

      {/* Join / leave voice */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={active ? onLeave : onJoin}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
          active
            ? 'bg-red-900/40 border-red-700 text-red-400 hover:bg-red-900/60'
            : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-green-600 hover:text-green-400'
        }`}
      >
        {active ? (
          <>📵 Leave voice</>
        ) : (
          <>🎙️ Join voice</>
        )}
      </motion.button>
    </div>
  );
}
