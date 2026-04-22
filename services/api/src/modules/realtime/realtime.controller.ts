import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '@modules/auth/current-user.decorator';
import { JwtAuthGuard } from '@modules/auth/jwt-auth.guard';
import type { JwtUser } from '@modules/auth/auth.types';
import { AuthorizeChannelDto } from './realtime.dto';
import { RealtimeService } from './realtime.service';

@Controller('realtime')
export class RealtimeController {
    constructor(private readonly realtime: RealtimeService) {}

    @Post('authorize')
    @UseGuards(JwtAuthGuard)
    authorize(@CurrentUser() user: JwtUser, @Body() dto: AuthorizeChannelDto) {
        return this.realtime.authorizeChannel(user, dto.channel);
    }
}
