import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../database/prisma.service.js';
import { loadConfig, AppConfig } from '../config/configuration.js';
import { validateTelegramInitData } from './telegram-validator.js';
import { UserRole, AuthUser } from '@smart-quiz/shared';

@Injectable()
export class AuthService {
  private config: AppConfig;

  constructor(private prisma: PrismaService) {
    this.config = loadConfig();
  }

  /**
   * Validates Telegram Mini App initData and logs in or registers the user.
   */
  async loginWithTelegramInitData(initDataRaw: string): Promise<{ token: string; user: AuthUser }> {
    const botToken = this.config.botToken;
    if (!botToken) {
      throw new BadRequestException('BOT_TOKEN is not configured on the server');
    }

    const validation = validateTelegramInitData(initDataRaw, botToken);
    if (!validation.isValid || !validation.user) {
      throw new UnauthorizedException(validation.error || 'Invalid Telegram authentication');
    }

    const tgUser = validation.user;
    const isSuperAdmin = this.config.superAdminTelegramIds.includes(String(tgUser.id));

    // Upsert user in database
    const user = await this.prisma.user.upsert({
      where: { telegramId: BigInt(tgUser.id) },
      update: {
        username: tgUser.username || null,
        firstName: tgUser.first_name || 'Foydalanuvchi',
        lastName: tgUser.last_name || null,
        ...(isSuperAdmin ? { role: UserRole.SUPER_ADMIN } : {}),
      },
      create: {
        telegramId: BigInt(tgUser.id),
        username: tgUser.username || null,
        firstName: tgUser.first_name || 'Foydalanuvchi',
        lastName: tgUser.last_name || null,
        role: isSuperAdmin ? UserRole.SUPER_ADMIN : UserRole.TEACHER,
      },
    });

    if (!user.isActive) {
      throw new ForbiddenException('Ushbu hisob administrator tomonidan to‘xtatilgan');
    }

    const authUser: AuthUser = {
      id: user.id,
      telegramId: user.telegramId.toString(),
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as UserRole,
      isActive: user.isActive,
    };

    const token = this.generateToken(authUser);
    return { token, user: authUser };
  }

  /**
   * Web Login for local development and testing.
   * SECURITY: In production, passwordless credential login is strictly forbidden.
   * Super-admin role can NEVER be claimed via client input; it must strictly match SUPER_ADMIN_TELEGRAM_IDS.
   */
  async loginWithCredentials(identifier: string, requestedRole = UserRole.TEACHER): Promise<{ token: string; user: AuthUser }> {
    if (this.config.nodeEnv === 'production') {
      throw new ForbiddenException(
        'Ishlab chiqarish (production) muhitida parolsiz login taqiqlangan. Iltimos Telegram Mini App orqali kiring.'
      );
    }

    if (!identifier || identifier.trim() === '') {
      throw new BadRequestException('Foydalanuvchi identifikatori kiritilishi shart');
    }

    let numericId: bigint;
    if (/^\d+$/.test(identifier)) {
      numericId = BigInt(identifier);
    } else {
      let hash = 0;
      for (let i = 0; i < identifier.length; i++) {
        hash = (hash << 5) - hash + identifier.charCodeAt(i);
        hash |= 0;
      }
      numericId = BigInt(Math.abs(hash) + 1000000);
    }

    // STRICT: Only grant SUPER_ADMIN if ID is genuinely present in SUPER_ADMIN_TELEGRAM_IDS
    const isSuperAdmin = this.config.superAdminTelegramIds.includes(numericId.toString());
    const assignedRole = isSuperAdmin
      ? UserRole.SUPER_ADMIN
      : requestedRole === UserRole.STUDENT
      ? UserRole.STUDENT
      : UserRole.TEACHER;

    const user = await this.prisma.user.upsert({
      where: { telegramId: numericId },
      update: {
        role: isSuperAdmin ? UserRole.SUPER_ADMIN : assignedRole,
      },
      create: {
        telegramId: numericId,
        username: identifier.startsWith('@') ? identifier.slice(1) : identifier,
        firstName: identifier,
        role: assignedRole,
      },
    });

    if (!user.isActive) {
      throw new ForbiddenException('Ushbu hisob administrator tomonidan to‘xtatilgan');
    }

    const authUser: AuthUser = {
      id: user.id,
      telegramId: user.telegramId.toString(),
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as UserRole,
      isActive: user.isActive,
    };

    const token = this.generateToken(authUser);
    return { token, user: authUser };
  }

  generateToken(user: AuthUser): string {
    return jwt.sign(
      {
        sub: user.id,
        telegramId: user.telegramId,
        role: user.role,
        username: user.username,
      },
      this.config.jwtSecret,
      { expiresIn: '30d' }
    );
  }

  verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.config.jwtSecret);
    } catch {
      throw new UnauthorizedException('Token yaroqsiz yoki muddati o‘tgan');
    }
  }

  async getUserById(id: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) return null;
    return {
      id: user.id,
      telegramId: user.telegramId.toString(),
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as UserRole,
      isActive: user.isActive,
    };
  }
}
