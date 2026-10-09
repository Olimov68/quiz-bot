import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { calculateLeaderboard, ParticipantScoreInput } from '@smart-quiz/quiz-engine';
import { QuizSessionMode, SessionStatus, UserRole, QuizStatus } from '@smart-quiz/shared';

@Injectable()
export class SessionsService {
  constructor(private prisma: PrismaService) {}

  async createSession(
    userId: string,
    quizId: string,
    mode = QuizSessionMode.LIVE_GROUP,
    groupId?: string,
    telegramChatId?: bigint
  ) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: {
            questions: {
              include: { options: true },
            },
          },
        },
      },
    });

    if (!quiz || quiz.versions.length === 0) {
      throw new NotFoundException('Test topilmadi');
    }

    // SECURITY CHECK: Verify caller owns the quiz or it is officially published
    if (quiz.creatorId !== userId && quiz.status !== QuizStatus.PUBLISHED) {
      throw new ForbiddenException('Ushbu testdan foydalanish yoki sessiya yaratish uchun ruxsatingiz yo‘q');
    }

    const version = quiz.versions[0];
    if (version.questions.length === 0) {
      throw new BadRequestException('Ushbu testda hali savollar mavjud emas');
    }

    const session = await this.prisma.quizSession.create({
      data: {
        quizVersionId: version.id,
        createdById: userId,
        groupId: groupId || null,
        telegramChatId: telegramChatId || null,
        mode,
        status: SessionStatus.WAITING_PARTICIPANTS,
        settingsSnapshot: (quiz.settings as any) || undefined,
      },
      include: {
        quizVersion: {
          include: {
            quiz: true,
            questions: {
              include: { options: true },
            },
          },
        },
      },
    });

    return session;
  }

  async joinSession(sessionId: string, userId: string, tgSnapshot?: any) {
    const session = await this.prisma.quizSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Sessiya topilmadi');

    return this.prisma.sessionParticipant.upsert({
      where: {
        sessionId_userId: { sessionId, userId },
      },
      update: {
        telegramUserSnapshot: tgSnapshot || undefined,
      },
      create: {
        sessionId,
        userId,
        telegramUserSnapshot: tgSnapshot || undefined,
        score: 0,
        totalAnswered: 0,
        totalCorrect: 0,
      },
    });
  }

  async getSession(id: string) {
    const session = await this.prisma.quizSession.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        quizVersion: {
          include: {
            quiz: true,
            questions: {
              orderBy: { questionIndex: 'asc' },
              include: { options: true },
            },
          },
        },
        participants: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, username: true, telegramId: true } },
          },
        },
      },
    });

    if (!session) throw new NotFoundException('Sessiya topilmadi');
    return session;
  }

  async listSessions(userId: string, role: UserRole) {
    const where = role === UserRole.SUPER_ADMIN ? {} : { createdById: userId };
    return this.prisma.quizSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        quizVersion: { select: { title: true } },
        _count: { select: { participants: true } },
      },
    });
  }

  async getSessionLeaderboard(sessionId: string) {
    const session = await this.getSession(sessionId);
    const totalQuestions = session.quizVersion.questions.length;

    const participantsInput: ParticipantScoreInput[] = session.participants.map((p) => {
      const tgSnap = p.telegramUserSnapshot as any;
      const displayName =
        tgSnap?.first_name ||
        `${p.user.firstName} ${p.user.lastName || ''}`.trim() ||
        'Qatnashchi';

      return {
        userId: p.userId,
        telegramId: p.user.telegramId.toString(),
        displayName,
        username: p.user.username,
        score: p.score,
        totalQuestions,
        totalTimeMs: Number(p.totalTimeMs),
        joinTimestamp: p.joinedAt.getTime(),
      };
    });

    const leaderboard = calculateLeaderboard(participantsInput);
    return {
      session: {
        id: session.id,
        title: session.quizVersion.title,
        status: session.status,
        totalQuestions,
        participantsCount: session.participants.length,
      },
      leaderboard,
    };
  }

  /**
   * Records poll answer with idempotent scoring.
   * Duplicate webhook deliveries will NEVER inflate totalAnswered or score!
   */
  async recordPollAnswer(
    pollInstanceId: string,
    userId: string,
    selectedOptions: number[],
    isCorrect: boolean,
    responseTimeMs: number
  ) {
    const poll = await this.prisma.pollInstance.findUnique({
      where: { id: pollInstanceId },
      include: { session: true },
    });

    if (!poll) return null;

    const existingAnswer = await this.prisma.pollAnswer.findUnique({
      where: {
        pollInstanceId_userId: { pollInstanceId, userId },
      },
    });

    if (existingAnswer) {
      // Calculate delta to prevent score inflation on duplicate updates
      const oldScore = existingAnswer.isCorrect ? 1 : 0;
      const newScore = isCorrect ? 1 : 0;
      const deltaScore = newScore - oldScore;

      // Update existing record
      const updated = await this.prisma.pollAnswer.update({
        where: { id: existingAnswer.id },
        data: {
          selectedOptions,
          isCorrect,
          responseTimeMs,
        },
      });

      if (deltaScore !== 0) {
        await this.prisma.sessionParticipant.update({
          where: {
            sessionId_userId: { sessionId: poll.sessionId, userId },
          },
          data: {
            score: { increment: deltaScore },
            totalCorrect: { increment: deltaScore },
          },
        });
      }

      return updated;
    }

    // First time answering this question
    const answer = await this.prisma.pollAnswer.create({
      data: {
        pollInstanceId,
        userId,
        telegramPollId: poll.telegramPollId,
        selectedOptions,
        isCorrect,
        responseTimeMs,
      },
    });

    await this.prisma.sessionParticipant.upsert({
      where: {
        sessionId_userId: { sessionId: poll.sessionId, userId },
      },
      update: {
        score: { increment: isCorrect ? 1 : 0 },
        totalAnswered: { increment: 1 },
        totalCorrect: { increment: isCorrect ? 1 : 0 },
        totalTimeMs: { increment: BigInt(responseTimeMs) },
      },
      create: {
        sessionId: poll.sessionId,
        userId,
        score: isCorrect ? 1 : 0,
        totalAnswered: 1,
        totalCorrect: isCorrect ? 1 : 0,
        totalTimeMs: BigInt(responseTimeMs),
      },
    });

    return answer;
  }
}
