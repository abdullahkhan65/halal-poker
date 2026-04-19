import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect,
  MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PokerService } from './poker.service';

const TURN_MS = 30_000;

@WebSocketGateway({ cors: { origin: '*' } })
export class PokerGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private turnTimers = new Map<string, NodeJS.Timeout>();

  constructor(private poker: PokerService, private jwt: JwtService) {}

  afterInit() {}

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string;
      const payload = this.jwt.verify(token);
      (client as any).userId = payload.sub;
      (client as any).userName = payload.email?.split('@')[0] ?? 'Player';
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = (client as any).userId;
    if (userId) {
      const tableId = this.poker.getPlayerTable(userId);
      if (tableId) {
        this.poker.markDisconnected(tableId, userId);
        this.broadcastTable(tableId);
        this.server.to(tableId).emit('voice_peer_left', { userId });
      }
    }
  }

  // ── Game events ──────────────────────────────────────────────────────────

  @SubscribeMessage('join_table')
  handleJoinTable(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tableId: string; chips?: number; name?: string; avatarUrl?: string; avatarStyle?: string },
  ) {
    const userId = (client as any).userId;
    const userName = data.name ?? (client as any).userName;
    client.join(data.tableId);
    const state = this.poker.joinTable(
      data.tableId, userId, userName, data.chips ?? 20000,
      data.avatarUrl, data.avatarStyle,
    );
    this.broadcastTable(data.tableId);
    return state;
  }

  @SubscribeMessage('leave_table')
  handleLeaveTable(@ConnectedSocket() client: Socket, @MessageBody() data: { tableId: string }) {
    const userId = (client as any).userId;
    client.leave(data.tableId);
    this.poker.leaveTable(data.tableId, userId);
    this.broadcastTable(data.tableId);
    this.server.to(data.tableId).emit('voice_peer_left', { userId });
  }

  @SubscribeMessage('start_game')
  async handleStartGame(@ConnectedSocket() client: Socket, @MessageBody() data: { tableId: string }) {
    const state = await this.poker.startGame(data.tableId);
    this.broadcastTable(data.tableId);
    if (state?.status === 'playing') this.resetTurnTimer(data.tableId);
    return state;
  }

  @SubscribeMessage('player_action')
  handlePlayerAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tableId: string; action: string; raiseAmount?: number },
  ) {
    const userId = (client as any).userId;
    const state = this.poker.applyAction(data.tableId, userId, data.action as any, data.raiseAmount);
    this.broadcastTable(data.tableId);
    if (state?.status === 'playing') {
      this.resetTurnTimer(data.tableId);
    } else {
      this.clearTurnTimer(data.tableId);
    }
    return state;
  }

  @SubscribeMessage('get_tables')
  handleGetTables() {
    return this.poker.listTables();
  }

  @SubscribeMessage('create_table')
  handleCreateTable(@ConnectedSocket() client: Socket, @MessageBody() data: { name: string }) {
    const table = this.poker.createTable(data.name);
    this.server.emit('tables_updated', this.poker.listTables());
    return table;
  }

  @SubscribeMessage('rebuy')
  handleRebuy(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tableId: string; chips?: number },
  ) {
    const userId = (client as any).userId;
    const chips = data.chips ?? 20000;
    const state = this.poker.rebuy(data.tableId, userId, chips);
    this.broadcastTable(data.tableId);
    return state;
  }

  @SubscribeMessage('profile_updated')
  handleProfileUpdated(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { name?: string; avatarUrl?: string | null; avatarStyle?: string | null },
  ) {
    const userId = (client as any).userId;
    const result = this.poker.updatePlayerProfile(userId, data.name, data.avatarUrl, data.avatarStyle);
    if (result) this.broadcastTable(result.tableId);
  }

  // ── Table chat ──────────────────────────────────────────────────────────

  @SubscribeMessage('chat_message')
  handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tableId: string; message: string },
  ) {
    const userId = (client as any).userId;
    if (!data.message?.trim()) return;
    const state = this.poker.getPublicState(data.tableId) as any;
    const player = state?.players?.find((p: any) => p.id === userId);
    this.server.to(data.tableId).emit('chat_message', {
      userId,
      name: player?.name ?? (client as any).userName,
      avatarUrl: player?.avatarUrl,
      avatarStyle: player?.avatarStyle,
      message: data.message.slice(0, 300),
      timestamp: Date.now(),
    });
  }

  // ── WebRTC voice signaling ───────────────────────────────────────────────

  @SubscribeMessage('voice_join')
  handleVoiceJoin(@ConnectedSocket() client: Socket, @MessageBody() data: { tableId: string }) {
    const userId = (client as any).userId;
    const userName = (client as any).userName;
    client.to(data.tableId).emit('voice_peer_joined', { userId, userName });
  }

  @SubscribeMessage('voice_offer')
  handleVoiceOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tableId: string; targetId: string; offer: RTCSessionDescriptionInit },
  ) {
    const fromId = (client as any).userId;
    const fromName = (client as any).userName;
    client.to(data.tableId).emit('voice_offer', { fromId, fromName, offer: data.offer });
  }

  @SubscribeMessage('voice_answer')
  handleVoiceAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tableId: string; targetId: string; answer: RTCSessionDescriptionInit },
  ) {
    const fromId = (client as any).userId;
    client.to(data.tableId).emit('voice_answer', { fromId, answer: data.answer });
  }

  @SubscribeMessage('voice_ice')
  handleVoiceIce(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tableId: string; targetId: string; candidate: RTCIceCandidateInit },
  ) {
    const fromId = (client as any).userId;
    client.to(data.tableId).emit('voice_ice', { fromId, candidate: data.candidate });
  }

  // ── Turn timer ───────────────────────────────────────────────────────────

  private resetTurnTimer(tableId: string) {
    this.clearTurnTimer(tableId);
    this.poker.setTurnExpiry(tableId, Date.now() + TURN_MS);
    // broadcast updated expiry immediately
    this.broadcastTable(tableId);

    const timer = setTimeout(() => {
      const activePlayerId = this.poker.getActivePlayerId(tableId);
      if (activePlayerId) {
        this.poker.applyAction(tableId, activePlayerId, 'fold');
        this.broadcastTable(tableId);
        const stillPlaying = this.poker.getActivePlayerId(tableId);
        if (stillPlaying) this.resetTurnTimer(tableId);
      }
    }, TURN_MS);

    this.turnTimers.set(tableId, timer);
  }

  private clearTurnTimer(tableId: string) {
    const t = this.turnTimers.get(tableId);
    if (t) { clearTimeout(t); this.turnTimers.delete(tableId); }
  }

  // ─────────────────────────────────────────────────────────────────────────

  private broadcastTable(tableId: string) {
    const state = this.poker.getPublicState(tableId);
    this.server.to(tableId).emit('game_state', state);
  }
}
