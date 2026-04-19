import { motion } from 'framer-motion';
import type { Card } from '../store/game.store';

const SUIT_SYMBOL: Record<string, string> = {
  spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣',
};
const RED_SUITS = new Set(['hearts', 'diamonds']);

interface Props {
  card?: Card;
  faceDown?: boolean;
  delay?: number;
  small?: boolean;
}

export function PlayingCard({ card, faceDown, delay = 0, small }: Props) {
  const size = small ? 'w-10 h-14 text-xs' : 'w-16 h-24 text-sm';

  return (
    <motion.div
      initial={{ scale: 0, rotateY: 90, opacity: 0 }}
      animate={{ scale: 1, rotateY: 0, opacity: 1 }}
      transition={{ delay, duration: 0.3, type: 'spring' }}
      className={`${size} rounded-lg flex flex-col items-center justify-center font-bold select-none
        ${faceDown
          ? 'bg-gradient-to-br from-blue-900 to-blue-700 border border-blue-500'
          : 'bg-white border border-gray-200 shadow-lg'
        }`}
    >
      {faceDown ? (
        <span className="text-blue-300 text-lg">🂠</span>
      ) : card ? (
        <div className={`flex flex-col items-center ${RED_SUITS.has(card.suit) ? 'text-red-600' : 'text-gray-900'}`}>
          <span className={small ? 'text-sm' : 'text-lg leading-none'}>{card.rank}</span>
          <span className={small ? 'text-base' : 'text-2xl leading-none'}>{SUIT_SYMBOL[card.suit]}</span>
        </div>
      ) : null}
    </motion.div>
  );
}
