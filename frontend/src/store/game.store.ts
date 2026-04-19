import { create } from 'zustand';

export interface Card { rank: string; suit: string }
export interface PlayerState {
  id: string; name: string; chips: number; holeCards: Card[];
  bet: number; totalBet: number; folded: boolean; allIn: boolean; connected: boolean;
}
export interface GameState {
  tableId: string; players: PlayerState[]; communityCards: Card[];
  pot: number; currentBet: number; round: string; activePlayerIndex: number;
  dealerIndex: number; smallBlind: number; bigBlind: number; minRaise: number;
  winnerId?: string; winnerAmount?: number; handRank?: string;
  status: 'waiting' | 'playing' | 'finished';
}
export interface TableInfo { id: string; name: string; playerCount: number; status: string }

interface GameStore {
  tables: TableInfo[];
  currentGame: GameState | null;
  currentTableId: string | null;
  setTables: (tables: TableInfo[]) => void;
  setGame: (game: GameState) => void;
  setTableId: (id: string | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  tables: [],
  currentGame: null,
  currentTableId: null,
  setTables: (tables) => set({ tables }),
  setGame: (game) => set({ currentGame: game }),
  setTableId: (id) => set({ currentTableId: id }),
  reset: () => set({ currentGame: null, currentTableId: null }),
}));
