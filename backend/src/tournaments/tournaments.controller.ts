import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../common/admin.guard';

@Controller('tournaments')
@UseGuards(JwtAuthGuard)
export class TournamentsController {
  constructor(private t: TournamentsService) {}

  @Get()
  findAll() { return this.t.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.t.findOne(id); }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body('name') name: string) { return this.t.create(name); }

  @Post(':id/players')
  @UseGuards(AdminGuard)
  addPlayer(@Param('id') id: string, @Body('userId') userId: string) {
    return this.t.addPlayer(id, userId);
  }

  @Post(':id/start')
  @UseGuards(AdminGuard)
  start(@Param('id') id: string) { return this.t.start(id); }

  @Patch('matches/:matchId/winner')
  @UseGuards(AdminGuard)
  reportWinner(@Param('matchId') matchId: string, @Body('winnerId') winnerId: string) {
    return this.t.reportWinner(matchId, winnerId);
  }
}
