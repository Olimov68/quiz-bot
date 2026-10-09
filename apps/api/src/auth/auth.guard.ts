import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Optional fallback for dev headers
      const devUserId = request.headers['x-dev-user-id'];
      if (devUserId && process.env.NODE_ENV !== 'production') {
        const user = await this.authService.getUserById(devUserId);
        if (user) {
          request.user = user;
          return true;
        }
      }
      throw new UnauthorizedException('Avtorizatsiya talab etiladi (Bearer token topilmadi)');
    }

    const token = authHeader.substring(7);
    const payload = this.authService.verifyToken(token);
    const user = await this.authService.getUserById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Foydalanuvchi topilmadi yoki hisob faol emas');
    }

    request.user = user;
    return true;
  }
}
