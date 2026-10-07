import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { AuthUser } from '../../auth/types/auth-user.type';
import { ROLES } from '../constants/rbac';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const user = context.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user) {
      throw new ForbiddenException('You do not have permission to perform this action.');
    }
    if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.ADMIN) {
      return true;
    }
    const ok = required.every((code) => user.permissions.includes(code));
    if (!ok) {
      throw new ForbiddenException('You do not have permission to perform this action.');
    }
    return true;
  }
}
