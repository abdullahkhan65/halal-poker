import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('magic-link')
  sendMagicLink(@Body('email') email: string) {
    return this.auth.sendMagicLink(email);
  }

  @Post('verify')
  verify(@Body('token') token: string, @Body('inviteCode') inviteCode?: string) {
    return this.auth.verifyToken(token, inviteCode);
  }

  @Post('dev-login')
  devLogin(@Body('email') email: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Not available in production');
    }
    return this.auth.devLogin(email);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Request() req) {
    return req.user;
  }
}
