import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  // Never throw — return null for unauthenticated requests

  handleRequest<TUser = any>(_err: unknown, user: TUser): TUser {
    return user ?? (null as unknown as TUser);
  }
}
