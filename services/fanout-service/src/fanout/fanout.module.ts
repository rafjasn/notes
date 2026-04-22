import { Module } from '@nestjs/common';
import { FanoutGateway } from './fanout.gateway';
import { FanoutService } from './fanout.service';
import { AuthTokenService } from './auth-token.service';
import { SubscriptionAuthorizerService } from './subscription-authorizer.service';

@Module({
    providers: [FanoutGateway, FanoutService, AuthTokenService, SubscriptionAuthorizerService]
})
export class FanoutModule {}
