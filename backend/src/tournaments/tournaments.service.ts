import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TournamentsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.tournament.findMany({
      include: {
        players: { include: { user: { select: { id: true, name: true, avatarUrl: true, avatarStyle: true } } } },
        matches: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.tournament.findUnique({
      where: { id },
      include: {
        players: { include: { user: { select: { id: true, name: true, avatarUrl: true, avatarStyle: true } } }, orderBy: { seed: 'asc' } },
        matches: { orderBy: [{ round: 'asc' }, { seat: 'asc' }] },
      },
    });
  }

  create(name: string) {
    return this.prisma.tournament.create({ data: { name } });
  }

  async addPlayer(tournamentId: string, userId: string) {
    const t = await this.prisma.tournament.findUnique({ where: { id: tournamentId }, include: { players: true } });
    if (!t) throw new BadRequestException('Tournament not found');
    if (t.status !== 'pending') throw new BadRequestException('Tournament already started');
    const seed = t.players.length + 1;
    return this.prisma.tournamentPlayer.create({ data: { tournamentId, userId, seed } });
  }

  async start(tournamentId: string) {
    const t = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { players: { orderBy: { seed: 'asc' } } },
    });
    if (!t) throw new BadRequestException('Tournament not found');
    if (t.status !== 'pending') throw new BadRequestException('Already started');
    if (t.players.length < 2) throw new BadRequestException('Need at least 2 players');

    const matches = generateBracket(t.players.map((p) => p.userId));
    await this.prisma.tournamentMatch.createMany({
      data: matches.map((m) => ({ ...m, tournamentId })),
    });
    await this.prisma.tournament.update({ where: { id: tournamentId }, data: { status: 'active' } });
    return this.findOne(tournamentId);
  }

  async reportWinner(matchId: string, winnerId: string) {
    const match = await this.prisma.tournamentMatch.findUnique({ where: { id: matchId } });
    if (!match) throw new BadRequestException('Match not found');
    if (match.winnerId) throw new BadRequestException('Already reported');

    await this.prisma.tournamentMatch.update({ where: { id: matchId }, data: { winnerId, status: 'done' } });

    const t = await this.findOne(match.tournamentId);
    if (!t) return;

    const allMatches = t.matches;
    const currentRound = allMatches.filter((m) => m.round === match.round);
    const allDone = currentRound.every((m) => m.status === 'done' || m.id === matchId);

    if (allDone) {
      const winners = currentRound
        .map((m) => (m.id === matchId ? winnerId : m.winnerId))
        .filter(Boolean) as string[];

      if (winners.length === 1) {
        await this.prisma.tournament.update({ where: { id: match.tournamentId }, data: { status: 'finished' } });
      } else {
        const nextRound = match.round + 1;
        const nextMatches = generateBracket(winners, nextRound);
        await this.prisma.tournamentMatch.createMany({
          data: nextMatches.map((m) => ({ ...m, tournamentId: match.tournamentId })),
        });
      }
    }

    return this.findOne(match.tournamentId);
  }
}

function generateBracket(playerIds: string[], round = 1) {
  const matches: { round: number; seat: number; player1Id: string | null; player2Id: string | null; status: string }[] = [];
  const padded = [...playerIds];

  // pad to next power of 2 with byes (null)
  const size = Math.pow(2, Math.ceil(Math.log2(padded.length)));
  while (padded.length < size) padded.push('BYE');

  for (let i = 0; i < padded.length; i += 2) {
    const p1 = padded[i] === 'BYE' ? null : padded[i];
    const p2 = padded[i + 1] === 'BYE' ? null : padded[i + 1];
    matches.push({ round, seat: i / 2 + 1, player1Id: p1, player2Id: p2, status: p2 === null ? 'done' : 'pending' });
  }
  return matches;
}
