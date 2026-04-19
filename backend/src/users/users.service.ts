import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: { id: true, name: true, email: true, avatarUrl: true, avatarStyle: true, totalEarnings: true, isAdmin: true },
    });
  }

  leaderboard() {
    return this.prisma.user.findMany({
      select: { id: true, name: true, avatarUrl: true, avatarStyle: true, totalEarnings: true },
      orderBy: { totalEarnings: 'desc' },
    });
  }

  update(id: string, data: { name?: string; avatarUrl?: string | null; avatarStyle?: string }) {
    return this.prisma.user.update({ where: { id }, data });
  }

  createInvite(createdById: string) {
    const code = randomBytes(5).toString('hex').toUpperCase();
    return this.prisma.invite.create({ data: { code, createdById } });
  }

  listInvites() {
    return this.prisma.invite.findMany({
      include: { createdBy: { select: { name: true } }, usedBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
