import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { UserRole } from '@smart-quiz/shared';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getPlatformStats() {
    const [
      totalUsers,
      totalTeachers,
      totalStudents,
      totalQuizzes,
      totalQuestions,
      totalSessions,
      totalAttempts,
      totalImports,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: UserRole.TEACHER } }),
      this.prisma.user.count({ where: { role: UserRole.STUDENT } }),
      this.prisma.quiz.count(),
      this.prisma.question.count(),
      this.prisma.quizSession.count(),
      this.prisma.quizAttempt.count(),
      this.prisma.importJob.count(),
    ]);

    const activeSessions = await this.prisma.quizSession.count({
      where: { status: 'ACTIVE' },
    });

    return {
      totalUsers,
      totalTeachers,
      totalStudents,
      totalQuizzes,
      totalQuestions,
      totalSessions,
      activeSessions,
      totalAttempts,
      totalImports,
    };
  }

  async listUsers(page = 1, limit = 20, search?: string) {
    const where: any = {};
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        id: u.id,
        telegramId: u.telegramId.toString(),
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }

  async toggleUserStatus(userId: string, isActive: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });
  }

  async getAuditLogs(limit = 50) {
    return this.prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { firstName: true, username: true } },
      },
    });
  }
}
