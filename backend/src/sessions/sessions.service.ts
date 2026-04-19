import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const START_CHIPS = 20000;

@Injectable()
export class SessionsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.session.findMany({
      include: { results: { include: { user: { select: { name: true, avatarUrl: true, avatarStyle: true } } } } },
      orderBy: { date: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.session.findUnique({
      where: { id },
      include: { results: { include: { user: { select: { name: true, avatarUrl: true, avatarStyle: true } } } } },
    });
  }

  create(data: { label?: string; isOnline?: boolean; date?: string }) {
    return this.prisma.session.create({
      data: {
        label: data.label,
        isOnline: data.isOnline ?? true,
        date: data.date ? new Date(data.date) : undefined,
      },
    });
  }

  async addResult(sessionId: string, userId: string, endChips: number, rebuys = 0) {
    const totalInvested = START_CHIPS + rebuys * START_CHIPS;
    const profit = endChips - totalInvested;

    const existing = await this.prisma.sessionResult.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });

    const result = await this.prisma.sessionResult.upsert({
      where: { sessionId_userId: { sessionId, userId } },
      update: { endChips, profit, rebuys },
      create: { sessionId, userId, startChips: START_CHIPS, endChips, profit, rebuys },
    });

    // Adjust totalEarnings: undo old profit if re-finalizing, apply new
    const oldProfit = existing?.profit ?? 0;
    const delta = profit - oldProfit;
    await this.prisma.user.update({
      where: { id: userId },
      data: { totalEarnings: { increment: delta } },
    });

    return result;
  }

  async finalizeSession(sessionId: string, results: { userId: string; endChips: number; rebuys?: number }[]) {
    for (const r of results) {
      await this.addResult(sessionId, r.userId, r.endChips, r.rebuys ?? 0);
    }
    return this.findOne(sessionId);
  }
}
