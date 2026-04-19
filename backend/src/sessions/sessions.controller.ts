import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../common/admin.guard';

@Controller('sessions')
@UseGuards(JwtAuthGuard)
export class SessionsController {
  constructor(private sessions: SessionsService) {}

  @Get()
  findAll() {
    return this.sessions.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sessions.findOne(id);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() body: { label?: string; isOnline?: boolean; date?: string }) {
    return this.sessions.create(body);
  }

  @Post(':id/finalize')
  @UseGuards(AdminGuard)
  finalize(
    @Param('id') id: string,
    @Body('results') results: { userId: string; endChips: number; rebuys?: number }[],
  ) {
    return this.sessions.finalizeSession(id, results);
  }
}
