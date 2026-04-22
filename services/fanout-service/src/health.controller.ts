import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
    @Get()
    health() {
        return {
            status: 'ok',
            service: 'notes-fanout',
            timestamp: new Date().toISOString()
        };
    }
}
