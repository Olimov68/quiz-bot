import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './auth.guard.js';
import { UserRole } from '@smart-quiz/shared';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Telegram Mini App authentication via initData
   */
  @Post('telegram-init')
  async loginWithTelegram(@Body() body: { initData: string }) {
    return this.authService.loginWithTelegramInitData(body.initData);
  }

  /**
   * Web Login (username or Telegram ID) for web dashboard access
   */
  @Post('login')
  async login(@Body() body: { identifier: string; role?: UserRole }) {
    return this.authService.loginWithCredentials(body.identifier, body.role);
  }

  /**
   * Get current authenticated user profile
   */
  @Get('me')
  @UseGuards(AuthGuard)
  async getMe(@Req() req: any) {
    return { user: req.user };
  }
}
