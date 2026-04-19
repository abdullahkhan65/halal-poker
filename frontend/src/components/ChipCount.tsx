import { motion } from 'framer-motion';

export function ChipCount({ value, className = '' }: { value: number; className?: string }) {
  const formatted = value.toLocaleString();
  const color = value > 0 ? 'text-yellow-400' : value < 0 ? 'text-red-400' : 'text-gray-400';
  return (
    <motion.span
      key={value}
      initial={{ scale: 1.3 }}
      animate={{ scale: 1 }}
      className={`font-mono font-bold ${color} ${className}`}
    >
      {value > 0 ? '+' : ''}{formatted}
    </motion.span>
  );
}
