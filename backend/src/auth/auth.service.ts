import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  private supabase;

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {
    this.supabase = createClient(
      config.get<string>('SUPABASE_URL') ?? '',
      config.get<string>('SUPABASE_SERVICE_KEY') ?? '',
    );
  }

  async sendMagicLink(email: string) {
    const { error } = await this.supabase.auth.signInWithOtp({ email });
    if (error) throw new BadRequestException(error.message);
    return { message: 'Magic link sent' };
  }

  async verifyToken(token: string, inviteCode?: string) {
    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user) throw new UnauthorizedException('Invalid token');

    const email = data.user.email;
    let user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      if (!inviteCode) throw new UnauthorizedException('Invite code required for new accounts');
      const invite = await this.prisma.invite.findUnique({ where: { code: inviteCode } });
      if (!invite) throw new BadRequestException('Invalid invite code');
      const usedBy = await this.prisma.user.findUnique({ where: { inviteUsedId: invite.id } });
      if (usedBy) throw new BadRequestException('Invite code already used');

      user = await this.prisma.user.create({
        data: {
          email,
          name: email.split('@')[0],
          inviteUsedId: invite.id,
        },
      });
    }

    const accessToken = this.jwt.sign({ sub: user.id, email: user.email });
    return { accessToken, user };
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }
}
