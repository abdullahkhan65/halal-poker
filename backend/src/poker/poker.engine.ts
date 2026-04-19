export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';
export type Card = { rank: Rank; suit: Suit };

export type PlayerAction = 'fold' | 'check' | 'call' | 'raise';
export type BettingRound = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface PlayerState {
  id: string;
  name: string;
  chips: number;
  holeCards: Card[];
  bet: number;
  totalBet: number;
  folded: boolean;
  allIn: boolean;
  connected: boolean;
  rebuys: number;
  totalInvested: number;
  hasActed: boolean;
  avatarUrl?: string;
  avatarStyle?: string;
  lastAction?: string;
}

export interface GameState {
  tableId: string;
  players: PlayerState[];
  deck: Card[];
  communityCards: Card[];
  pot: number;
  currentBet: number;
  round: BettingRound;
  activePlayerIndex: number;
  dealerIndex: number;
  smallBlind: number;
  bigBlind: number;
  minRaise: number;
  winnerId?: string;
  winnerAmount?: number;
  handRank?: string;
  status: 'waiting' | 'playing' | 'finished';
  turnExpiresAt?: number;
}

const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANK_VALUE: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit });
  return deck;
}

export function shuffle(deck: Card[]): Card[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

export function initGame(
  tableId: string,
  players: { id: string; name: string; chips: number; avatarUrl?: string; avatarStyle?: string }[],
  dealerIndex = 0,
  smallBlind = 100,
): GameState {
  const deck = shuffle(buildDeck());
  const playerStates: PlayerState[] = players.map((p) => ({
    ...p,
    holeCards: [],
    bet: 0,
    totalBet: 0,
    folded: false,
    allIn: false,
    connected: true,
    rebuys: 0,
    totalInvested: p.chips,
    hasActed: false,
    lastAction: undefined,
  }));

  return {
    tableId,
    players: playerStates,
    deck,
    communityCards: [],
    pot: 0,
    currentBet: 0,
    round: 'preflop',
    activePlayerIndex: 0,
    dealerIndex,
    smallBlind,
    bigBlind: smallBlind * 2,
    minRaise: smallBlind * 2,
    status: 'waiting',
  };
}

export function dealHoleCards(state: GameState): GameState {
  const s = deepClone(state);
  s.status = 'playing';
  s.round = 'preflop';

  const n = s.players.length;
  const sbIdx = (s.dealerIndex + 1) % n;
  const bbIdx = (s.dealerIndex + 2) % n;

  for (const p of s.players) {
    p.holeCards = [s.deck.pop()!, s.deck.pop()!];
    p.bet = 0;
    p.totalBet = 0;
    p.folded = false;
    p.allIn = false;
    p.hasActed = false;
  }

  postBlind(s, sbIdx, s.smallBlind);
  postBlind(s, bbIdx, s.bigBlind);

  s.currentBet = s.bigBlind;
  s.minRaise = s.bigBlind;
  s.activePlayerIndex = (bbIdx + 1) % n;

  return s;
}

function postBlind(state: GameState, idx: number, amount: number) {
  const p = state.players[idx];
  const actual = Math.min(amount, p.chips);
  p.chips -= actual;
  p.bet = actual;
  p.totalBet = actual;
  state.pot += actual;
}

export function applyAction(
  state: GameState,
  playerId: string,
  action: PlayerAction,
  raiseAmount?: number,
): GameState {
  const s = deepClone(state);
  const idx = s.players.findIndex((p) => p.id === playerId);
  if (idx !== s.activePlayerIndex) return s;
  const player = s.players[idx];
  if (player.folded) return s;

  const callAmount = s.currentBet - player.bet;

  if (action === 'fold') {
    player.folded = true;
    player.lastAction = 'Folded';
  } else if (action === 'check') {
    if (callAmount > 0) return s;
    player.lastAction = 'Checked';
  } else if (action === 'call') {
    const actual = Math.min(callAmount, player.chips);
    player.chips -= actual;
    player.bet += actual;
    player.totalBet += actual;
    s.pot += actual;
    if (player.chips === 0) player.allIn = true;
    player.lastAction = `Called ${actual.toLocaleString()}`;
  } else if (action === 'raise') {
    const raise = raiseAmount ?? s.minRaise;
    const total = s.currentBet + raise;
    const actual = Math.min(total - player.bet, player.chips);
    player.chips -= actual;
    player.bet += actual;
    player.totalBet += actual;
    s.pot += actual;
    s.currentBet = player.bet;
    s.minRaise = raise;
    if (player.chips === 0) player.allIn = true;
    player.lastAction = player.allIn ? 'All-In' : `Raised to ${player.bet.toLocaleString()}`;
    // everyone else needs to act again after a raise
    for (const p of s.players) {
      if (p.id !== player.id) p.hasActed = false;
    }
  }

  player.hasActed = true;

  const activePlayers = s.players.filter((p) => !p.folded && !p.allIn);

  if (isBettingComplete(s)) {
    return advanceRound(s);
  }

  s.activePlayerIndex = nextActivePlayer(s, idx);
  return s;
}

function isBettingComplete(state: GameState): boolean {
  const active = state.players.filter((p) => !p.folded && !p.allIn);
  return active.every((p) => p.bet === state.currentBet && p.hasActed);
}

function nextActivePlayer(state: GameState, from: number): number {
  const n = state.players.length;
  let idx = (from + 1) % n;
  while (state.players[idx].folded || state.players[idx].allIn) {
    idx = (idx + 1) % n;
    if (idx === from) break;
  }
  return idx;
}

function advanceRound(state: GameState): GameState {
  const s = deepClone(state);

  for (const p of s.players) {
    p.bet = 0;
    p.hasActed = false;
    p.lastAction = undefined;
  }
  s.currentBet = 0;

  const alive = s.players.filter((p) => !p.folded);
  if (alive.length === 1) {
    return declareWinner(s, alive[0].id, 'Last player standing');
  }

  const rounds: BettingRound[] = ['preflop', 'flop', 'turn', 'river', 'showdown'];
  const next = rounds[rounds.indexOf(s.round) + 1] as BettingRound;

  if (next === 'flop') {
    s.communityCards.push(s.deck.pop()!, s.deck.pop()!, s.deck.pop()!);
  } else if (next === 'turn' || next === 'river') {
    s.communityCards.push(s.deck.pop()!);
  } else if (next === 'showdown') {
    return evaluateShowdown(s);
  }

  s.round = next;
  s.activePlayerIndex = nextActivePlayer(s, s.dealerIndex);
  return s;
}

function evaluateShowdown(state: GameState): GameState {
  const s = deepClone(state);
  const alive = s.players.filter((p) => !p.folded);

  let best: { player: PlayerState; score: number; rank: string } | null = null;
  for (const p of alive) {
    const all = [...p.holeCards, ...s.communityCards];
    const { score, rank } = evaluateHand(all);
    if (!best || score > best.score) best = { player: p, score, rank };
  }

  if (!best) return s;
  return declareWinner(s, best.player.id, best.rank);
}

function declareWinner(state: GameState, winnerId: string, handRank: string): GameState {
  const s = deepClone(state);
  const winner = s.players.find((p) => p.id === winnerId)!;
  winner.chips += s.pot;
  s.winnerId = winnerId;
  s.winnerAmount = s.pot;
  s.handRank = handRank;
  s.pot = 0;
  s.round = 'showdown';
  s.status = 'finished';
  return s;
}

function evaluateHand(cards: Card[]): { score: number; rank: string } {
  const combos = getCombinations(cards, 5);
  let best = { score: 0, rank: 'High Card' };
  for (const combo of combos) {
    const result = scoreHand(combo);
    if (result.score > best.score) best = result;
  }
  return best;
}

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
  const values = cards.map((c) => RANK_VALUE[c.rank]).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);
  const isStraight = checkStraight(values);

  const counts: Record<number, number> = {};
  for (const v of values) counts[v] = (counts[v] ?? 0) + 1;
  const groups = Object.values(counts).sort((a, b) => b - a);

  const highCard = values[0];

  if (isFlush && isStraight) return { score: 8000000 + highCard, rank: highCard === 14 ? 'Royal Flush' : 'Straight Flush' };
  if (groups[0] === 4) return { score: 7000000 + highCard, rank: 'Four of a Kind' };
  if (groups[0] === 3 && groups[1] === 2) return { score: 6000000 + highCard, rank: 'Full House' };
  if (isFlush) return { score: 5000000 + highCard, rank: 'Flush' };
  if (isStraight) return { score: 4000000 + highCard, rank: 'Straight' };
  if (groups[0] === 3) return { score: 3000000 + highCard, rank: 'Three of a Kind' };
  if (groups[0] === 2 && groups[1] === 2) return { score: 2000000 + highCard, rank: 'Two Pair' };
  if (groups[0] === 2) return { score: 1000000 + highCard, rank: 'One Pair' };
  return { score: highCard, rank: 'High Card' };
}

function checkStraight(sorted: number[]): boolean {
  if (sorted[0] - sorted[4] === 4 && new Set(sorted).size === 5) return true;
  if (sorted[0] === 14) {
    const low = [5, 4, 3, 2, 1];
    return low.every((v, i) => sorted[i + 1] === v || (i === 0 && sorted[1] === 5));
  }
  return false;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function rebuyPlayer(state: GameState, playerId: string, chips: number): GameState {
  const s = deepClone(state);
  const player = s.players.find((p) => p.id === playerId);
  if (!player) return s;
  player.chips += chips;
  player.rebuys += 1;
  player.totalInvested += chips;
  player.allIn = false;
  return s;
}
