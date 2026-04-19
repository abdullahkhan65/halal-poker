import { Controller, Get, Patch, Body, Param, UseGuards, Request, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../common/admin.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  findAll() {
    return this.users.findAll();
  }

  @Get('leaderboard')
  leaderboard() {
    return this.users.leaderboard();
  }

  @Patch('me')
  updateMe(@Request() req, @Body() body: { name?: string; avatarUrl?: string }) {
    return this.users.update(req.user.id, body);
  }

  @Post('invite')
  @UseGuards(AdminGuard)
  createInvite(@Request() req) {
    return this.users.createInvite(req.user.id);
  }

  @Get('invites')
  @UseGuards(AdminGuard)
  listInvites() {
    return this.users.listInvites();
  }
}
