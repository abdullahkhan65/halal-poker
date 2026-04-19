import { Injectable } from '@nestjs/common';
import { GameState, PlayerAction, dealHoleCards, applyAction, initGame, rebuyPlayer } from './poker.engine';
import { SessionsService } from '../sessions/sessions.service';

export interface TablePlayer {
  id: string;
  name: string;
  chips: number;
  avatarUrl?: string;
  avatarStyle?: string;
}

interface Table {
  id: string;
  name: string;
  state: GameState | null;
  players: TablePlayer[];
  sessionId?: string;
}

@Injectable()
export class PokerService {
  private tables = new Map<string, Table>();
  private playerTableMap = new Map<string, string>();

  constructor(private sessions: SessionsService) {}

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

  joinTable(
    tableId: string,
    userId: string,
    userName: string,
    chips: number,
    avatarUrl?: string,
    avatarStyle?: string,
  ) {
    let table = this.tables.get(tableId);
    if (!table) {
      table = { id: tableId, name: 'Table', state: null, players: [] };
      this.tables.set(tableId, table);
    }

    const existing = table.players.find((p) => p.id === userId);
    if (existing) {
      // update avatar on reconnect
      if (avatarUrl !== undefined) existing.avatarUrl = avatarUrl;
      if (avatarStyle !== undefined) existing.avatarStyle = avatarStyle;
    } else {
      table.players.push({ id: userId, name: userName, chips, avatarUrl, avatarStyle });
    }

    this.playerTableMap.set(userId, tableId);

    if (table.state) {
      const statePlayer = table.state.players.find((p) => p.id === userId);
      if (statePlayer) {
        statePlayer.connected = true;
        if (avatarUrl !== undefined) statePlayer.avatarUrl = avatarUrl;
        if (avatarStyle !== undefined) statePlayer.avatarStyle = avatarStyle;
      }
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

  updatePlayerProfile(userId: string, name?: string, avatarUrl?: string | null, avatarStyle?: string | null) {
    const tableId = this.playerTableMap.get(userId);
    if (!tableId) return null;
    const table = this.tables.get(tableId);
    if (!table) return null;

    const tablePlayer = table.players.find((p) => p.id === userId);
    if (tablePlayer) {
      if (name) tablePlayer.name = name;
      if (avatarUrl !== undefined) tablePlayer.avatarUrl = avatarUrl ?? undefined;
      if (avatarStyle !== undefined) tablePlayer.avatarStyle = avatarStyle ?? undefined;
    }

    if (table.state) {
      const statePlayer = table.state.players.find((p) => p.id === userId);
      if (statePlayer) {
        if (name) statePlayer.name = name;
        if (avatarUrl !== undefined) statePlayer.avatarUrl = avatarUrl ?? undefined;
        if (avatarStyle !== undefined) statePlayer.avatarStyle = avatarStyle ?? undefined;
      }
    }

    return { tableId, state: this.getPublicState(tableId) };
  }

  setTurnExpiry(tableId: string, expiry: number) {
    const table = this.tables.get(tableId);
    if (table?.state) table.state.turnExpiresAt = expiry;
  }

  getActivePlayerId(tableId: string): string | null {
    const table = this.tables.get(tableId);
    if (!table?.state || table.state.status !== 'playing') return null;
    return table.state.players[table.state.activePlayerIndex]?.id ?? null;
  }

  async startGame(tableId: string) {
    const table = this.tables.get(tableId);
    if (!table || table.players.length < 2) return null;

    if (!table.sessionId) {
      try {
        const session = await this.sessions.create({ label: table.name, isOnline: true });
        table.sessionId = session.id;
      } catch (e) {
        console.error('Failed to create session:', e);
      }
    }

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

    if (table.state.status === 'finished' && table.sessionId) {
      this.saveHandResults(table).catch((e) => console.error('Session save failed:', e));
    }

    return this.getPublicState(tableId);
  }

  rebuy(tableId: string, userId: string, chips: number) {
    const table = this.tables.get(tableId);
    if (!table?.state) return null;
    table.state = rebuyPlayer(table.state, userId, chips);
    return this.getPublicState(tableId);
  }

  private async saveHandResults(table: Table) {
    if (!table.sessionId || !table.state) return;
    const results = table.state.players.map((p) => ({
      userId: p.id,
      endChips: p.chips,
      rebuys: p.rebuys,
    }));
    await this.sessions.finalizeSession(table.sessionId, results);
  }

  getPublicState(tableId: string) {
    const table = this.tables.get(tableId);
    if (!table) return null;

    if (!table.state) {
      return { tableId, status: 'waiting', players: table.players };
    }

    return {
      ...table.state,
      players: table.state.players.map((p) => {
        const tp = table.players.find((tp) => tp.id === p.id);
        return {
          ...p,
          avatarUrl: p.avatarUrl ?? tp?.avatarUrl,
          avatarStyle: p.avatarStyle ?? tp?.avatarStyle,
        };
      }),
    };
  }
}
