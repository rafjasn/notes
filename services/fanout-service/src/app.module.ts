import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './configuration';
import { FanoutModule } from './fanout/fanout.module';
import { HealthController } from './health.controller';

@Module({
    imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] }), FanoutModule],
    controllers: [HealthController]
})
export class AppModule {}
