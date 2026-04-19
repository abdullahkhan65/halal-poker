type Card = { rank: string; suit: string };

const RANK_VALUE: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14,
};

function getCombinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  return [
    ...getCombinations(rest, k - 1).map((c) => [first, ...c]),
    ...getCombinations(rest, k),
  ];
}

function scoreHand(cards: Card[]): { score: number; rank: string } {
  const values = cards.map((c) => RANK_VALUE[c.rank] ?? 0).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);
  const isStr8 =
    (values[0] - values[4] === 4 && new Set(values).size === 5) ||
    (values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2);

  const counts: Record<number, number> = {};
  for (const v of values) counts[v] = (counts[v] ?? 0) + 1;
  const groups = Object.values(counts).sort((a, b) => b - a);

  if (isFlush && isStr8) return { score: 8e6, rank: values[0] === 14 ? 'Royal Flush' : 'Straight Flush' };
  if (groups[0] === 4) return { score: 7e6, rank: 'Four of a Kind' };
  if (groups[0] === 3 && groups[1] === 2) return { score: 6e6, rank: 'Full House' };
  if (isFlush) return { score: 5e6, rank: 'Flush' };
  if (isStr8) return { score: 4e6, rank: 'Straight' };
  if (groups[0] === 3) return { score: 3e6, rank: 'Three of a Kind' };
  if (groups[0] === 2 && groups[1] === 2) return { score: 2e6, rank: 'Two Pair' };
  if (groups[0] === 2) {
    const pairVal = Number(Object.keys(counts).find((k) => counts[Number(k)] === 2));
    const pairRank = cards.find((c) => RANK_VALUE[c.rank] === pairVal)?.rank ?? '';
    return { score: 1e6 + pairVal, rank: `Pair ${pairRank}` };
  }
  const highRank = cards.find((c) => RANK_VALUE[c.rank] === values[0])?.rank ?? '';
  return { score: values[0], rank: `High Card ${highRank}` };
}

export function evaluateHandRank(cards: Card[]): string {
  const valid = cards.filter((c) => c?.rank && c?.suit);
  if (valid.length < 2) return '';
  if (valid.length < 5) return scoreHand(valid).rank;
  const combos = getCombinations(valid.slice(0, 7), 5);
  let best = { score: 0, rank: '' };
  for (const combo of combos) {
    const r = scoreHand(combo);
    if (r.score > best.score) best = r;
  }
  return best.rank;
}
