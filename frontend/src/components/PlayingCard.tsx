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
  const isRed = card ? RED_SUITS.has(card.suit) : false;
  const suit = card ? SUIT_SYMBOL[card.suit] : '';
  const rank = card?.rank ?? '';

  const w = small ? 40 : 64;
  const h = small ? 56 : 90;

  return (
    <motion.div
      initial={{ scale: 0.6, rotateY: 90, opacity: 0, y: -10 }}
      animate={{ scale: 1, rotateY: 0, opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, type: 'spring', stiffness: 260, damping: 20 }}
      style={{ width: w, height: h, perspective: 600 }}
      className="flex-shrink-0"
    >
      {faceDown ? (
        <div
          className="w-full h-full rounded-lg relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #1a1f6e 0%, #0f1450 50%, #1a1f6e 100%)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)',
            border: '1px solid rgba(100,110,200,0.3)',
          }}
        >
          {/* Diamond pattern */}
          <div className="absolute inset-0" style={{
            backgroundImage: `repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent ${small ? 8 : 12}px),
              repeating-linear-gradient(-45deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 1px, transparent 1px, transparent ${small ? 8 : 12}px)`,
          }} />
          {/* Gold inset border */}
          <div className="absolute rounded" style={{
            inset: small ? 3 : 5,
            border: '1px solid rgba(201,160,96,0.25)',
          }} />
          {/* Center diamond */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span style={{ color: 'rgba(201,160,96,0.35)', fontSize: small ? 14 : 20 }}>♦</span>
          </div>
        </div>
      ) : card ? (
        <div
          className="w-full h-full rounded-lg relative select-none"
          style={{
            background: 'linear-gradient(160deg, #faf6ee 0%, #f0ece0 100%)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.65), 0 1px 0 rgba(255,255,255,0.8) inset',
            border: '1px solid rgba(180,170,150,0.6)',
          }}
        >
          {/* Top-left pip */}
          <div className="absolute flex flex-col items-center leading-none"
            style={{ top: small ? 2 : 4, left: small ? 3 : 5 }}>
            <span style={{
              fontSize: small ? 10 : 15, fontWeight: 800, lineHeight: 1,
              color: isRed ? '#c0161e' : '#0f0f0f',
              fontFamily: 'Georgia, serif',
            }}>{rank}</span>
            <span style={{
              fontSize: small ? 8 : 12, lineHeight: 1, marginTop: 1,
              color: isRed ? '#c0161e' : '#0f0f0f',
            }}>{suit}</span>
          </div>

          {/* Center suit */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span style={{
              fontSize: small ? 18 : 30,
              color: isRed ? '#c0161e' : '#0f0f0f',
              filter: isRed ? 'drop-shadow(0 0 4px rgba(192,22,30,0.15))' : 'none',
            }}>{suit}</span>
          </div>

          {/* Bottom-right pip (rotated) */}
          <div className="absolute flex flex-col items-center leading-none rotate-180"
            style={{ bottom: small ? 2 : 4, right: small ? 3 : 5 }}>
            <span style={{
              fontSize: small ? 10 : 15, fontWeight: 800, lineHeight: 1,
              color: isRed ? '#c0161e' : '#0f0f0f',
              fontFamily: 'Georgia, serif',
            }}>{rank}</span>
            <span style={{
              fontSize: small ? 8 : 12, lineHeight: 1, marginTop: 1,
              color: isRed ? '#c0161e' : '#0f0f0f',
            }}>{suit}</span>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
