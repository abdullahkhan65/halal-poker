import { Injectable } from '@nestjs/common';
import { GameState, PlayerAction, dealHoleCards, applyAction, initGame, rebuyPlayer } from './poker.engine';

interface Table {
  id: string;
  name: string;
  state: GameState | null;
  players: { id: string; name: string; chips: number }[];
}

@Injectable()
export class PokerService {
  private tables = new Map<string, Table>();
  private playerTableMap = new Map<string, string>();

  createTable(name: string) {
    const id = Math.random().toString(36).slice(2, 8).toUpperCase();
    const table: Table = { id, name, state: null, players: [] };
    this.tables.set(id, table);
    return { id, name };
  }

  listTables() {
    return Array.from(this.tables.values()).map((t) => ({
      id: t.id,
      name: t.name,
      playerCount: t.players.length,
      status: t.state?.status ?? 'waiting',
    }));
  }

  getPlayerTable(userId: string) {
    return this.playerTableMap.get(userId);
  }

  joinTable(tableId: string, userId: string, userName: string, chips: number) {
    let table = this.tables.get(tableId);
    if (!table) {
      table = { id: tableId, name: 'Table', state: null, players: [] };
      this.tables.set(tableId, table);
    }

    if (!table.players.find((p) => p.id === userId)) {
      table.players.push({ id: userId, name: userName, chips });
    }

    this.playerTableMap.set(userId, tableId);

    if (table.state) {
      const existing = table.state.players.find((p) => p.id === userId);
      if (existing) existing.connected = true;
    }

    return this.getPublicState(tableId);
  }

  leaveTable(tableId: string, userId: string) {
    const table = this.tables.get(tableId);
    if (!table) return;
    table.players = table.players.filter((p) => p.id !== userId);
    this.playerTableMap.delete(userId);
  }

  markDisconnected(tableId: string, userId: string) {
    const table = this.tables.get(tableId);
    if (!table?.state) return;
    const p = table.state.players.find((p) => p.id === userId);
    if (p) p.connected = false;
  }

  startGame(tableId: string) {
    const table = this.tables.get(tableId);
    if (!table || table.players.length < 2) return null;

    const prevDealer = table.state?.dealerIndex ?? -1;
    const dealerIndex = (prevDealer + 1) % table.players.length;

    table.state = initGame(tableId, table.players, dealerIndex);
    table.state = dealHoleCards(table.state);
    return this.getPublicState(tableId);
  }

  applyAction(tableId: string, userId: string, action: PlayerAction, raiseAmount?: number) {
    const table = this.tables.get(tableId);
    if (!table?.state) return null;
    table.state = applyAction(table.state, userId, action, raiseAmount);
    return this.getPublicState(tableId);
  }

  rebuy(tableId: string, userId: string, chips: number) {
    const table = this.tables.get(tableId);
    if (!table?.state) return null;
    table.state = rebuyPlayer(table.state, userId, chips);
    return this.getPublicState(tableId);
  }

  getPublicState(tableId: string) {
    const table = this.tables.get(tableId);
    if (!table) return null;

    if (!table.state) {
      return { tableId, status: 'waiting', players: table.players };
    }

    return {
      ...table.state,
      players: table.state.players.map((p) => ({
        ...p,
        holeCards: p.holeCards,
      })),
    };
  }
}
