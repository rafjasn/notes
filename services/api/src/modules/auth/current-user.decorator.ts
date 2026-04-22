import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtUser } from './auth.types';

export const CurrentUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): JwtUser => ctx.switchToHttp().getRequest().user
);
