import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class StudentService {
  constructor(private prisma: PrismaService) {}

  async getStudentStats(userId: string) {
    const attempts = await this.prisma.quizAttempt.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      include: {
        quizVersion: { select: { title: true } },
      },
    });

    const quizzesCount = attempts.length;
    const totalCorrect = attempts.reduce((acc, a) => acc + a.totalCorrect, 0);
    const totalIncorrect = attempts.reduce((acc, a) => acc + a.totalIncorrect, 0);
    const avgPercentage =
      quizzesCount > 0 ? attempts.reduce((acc, a) => acc + a.percentage, 0) / quizzesCount : 0;
    const bestScore =
      quizzesCount > 0 ? Math.max(...attempts.map((a) => a.percentage)) : 0;

    return {
      quizzesCount,
      totalCorrect,
      totalIncorrect,
      averagePercentage: avgPercentage,
      bestScore,
      recentAttempts: attempts.slice(0, 10).map((a) => ({
        id: a.id,
        quizTitle: a.quizVersion.title,
        score: a.score,
        totalCorrect: a.totalCorrect,
        percentage: a.percentage,
        completedAt: a.completedAt?.toISOString() || a.startedAt.toISOString(),
      })),
    };
  }

  async getStudentAttempts(userId: string) {
    return this.prisma.quizAttempt.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      include: {
        quizVersion: { select: { title: true } },
      },
    });
  }
}
