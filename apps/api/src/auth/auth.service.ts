import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../database/prisma.service.js';
import { loadConfig } from '../config/configuration.js';
import { validateTelegramInitData } from './telegram-validator.js';
import { UserRole, AuthUser } from '@smart-quiz/shared';

@Injectable()
export class AuthService {
  private config = loadConfig();

  constructor(private prisma: PrismaService) {}

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
   * Development or Teacher Web Login (by Telegram ID or Demo username)
   */
  async loginWithCredentials(identifier: string, role = UserRole.TEACHER): Promise<{ token: string; user: AuthUser }> {
    let numericId: bigint;
    if (/^\d+$/.test(identifier)) {
      numericId = BigInt(identifier);
    } else {
      // Deterministic fake telegramId for demo usernames
      let hash = 0;
      for (let i = 0; i < identifier.length; i++) {
        hash = (hash << 5) - hash + identifier.charCodeAt(i);
        hash |= 0;
      }
      numericId = BigInt(Math.abs(hash) + 1000000);
    }

    const isSuperAdmin = this.config.superAdminTelegramIds.includes(numericId.toString()) || role === UserRole.SUPER_ADMIN;

    const user = await this.prisma.user.upsert({
      where: { telegramId: numericId },
      update: {
        role: isSuperAdmin ? UserRole.SUPER_ADMIN : role,
      },
      create: {
        telegramId: numericId,
        username: identifier.startsWith('@') ? identifier.slice(1) : identifier,
        firstName: identifier,
        role: isSuperAdmin ? UserRole.SUPER_ADMIN : role,
      },
    });

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
