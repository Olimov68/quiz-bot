import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { QuizStatus, UserRole } from '@smart-quiz/shared';

@Injectable()
export class QuizzesService {
  constructor(private prisma: PrismaService) {}

  async listQuizzes(userId: string, role: UserRole, search?: string) {
    const where: any = {};
    if (role !== UserRole.SUPER_ADMIN) {
      where.creatorId = userId;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
      ];
    }

    const quizzes = await this.prisma.quiz.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true, username: true } },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: {
            _count: { select: { questions: true, sessions: true } },
          },
        },
      },
    });

    return quizzes.map((q) => {
      const latestVer = q.versions[0];
      return {
        id: q.id,
        title: q.title,
        description: q.description,
        subject: q.subject,
        status: q.status,
        creatorId: q.creatorId,
        creatorName: `${q.creator.firstName} ${q.creator.lastName || ''}`.trim(),
        currentVersion: q.currentVersion,
        questionsCount: latestVer ? latestVer._count.questions : 0,
        sessionsCount: latestVer ? latestVer._count.sessions : 0,
        createdAt: q.createdAt.toISOString(),
        updatedAt: q.updatedAt.toISOString(),
      };
    });
  }

  async getQuizById(id: string, userId: string, role: UserRole) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, firstName: true, lastName: true, username: true } },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: {
            questions: {
              orderBy: { questionIndex: 'asc' },
              include: {
                options: { orderBy: { optionIndex: 'asc' } },
                assets: { include: { mediaAsset: true } },
              },
            },
          },
        },
      },
    });

    if (!quiz) {
      throw new NotFoundException('Test topilmadi');
    }

    if (role !== UserRole.SUPER_ADMIN && quiz.creatorId !== userId) {
      throw new ForbiddenException('Ushbu testni ko‘rish uchun ruxsatingiz yo‘q');
    }

    const latestVer = quiz.versions[0];

    return {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      subject: quiz.subject,
      status: quiz.status,
      creatorId: quiz.creatorId,
      creatorName: `${quiz.creator.firstName} ${quiz.creator.lastName || ''}`.trim(),
      currentVersion: quiz.currentVersion,
      settings: quiz.settings,
      questions: latestVer ? latestVer.questions : [],
      createdAt: quiz.createdAt.toISOString(),
      updatedAt: quiz.updatedAt.toISOString(),
    };
  }

  async createQuiz(userId: string, data: any) {
    const title = data.title || 'Yangi test';
    const description = data.description || null;
    const subject = data.subject || 'Umumiy';
    const settings = data.settings || {
      timeLimitPerQuestionSeconds: 30,
      shuffleQuestions: false,
      shuffleOptions: false,
      showExplanation: true,
      allowRetake: false,
      maxAttempts: 1,
    };

    const questionsData = data.questions || [];

    const quiz = await this.prisma.quiz.create({
      data: {
        title,
        description,
        subject,
        creatorId: userId,
        status: data.status || QuizStatus.DRAFT,
        currentVersion: 1,
        settings,
        versions: {
          create: {
            versionNumber: 1,
            title,
            description,
            settings,
            questions: {
              create: questionsData.map((q: any, idx: number) => ({
                questionIndex: idx + 1,
                text: q.text,
                explanation: q.explanation || null,
                hasMath: Boolean(q.hasMath),
                hasChemistry: Boolean(q.hasChemistry),
                timeLimitSeconds: q.timeLimitSeconds || null,
                points: q.points || 1,
                options: {
                  create: (q.options || []).map((opt: any, optIdx: number) => ({
                    optionIndex: optIdx,
                    text: opt.text,
                    isCorrect: Boolean(opt.isCorrect),
                  })),
                },
              })),
            },
          },
        },
      },
      include: {
        versions: {
          include: {
            questions: {
              include: { options: true },
            },
          },
        },
      },
    });

    return quiz;
  }

  async updateQuiz(id: string, userId: string, role: UserRole, data: any) {
    const existing = await this.prisma.quiz.findUnique({
      where: { id },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });

    if (!existing) throw new NotFoundException('Test topilmadi');
    if (role !== UserRole.SUPER_ADMIN && existing.creatorId !== userId) {
      throw new ForbiddenException('Tahrirlashga ruxsat yo‘q');
    }

    const nextVersionNumber = existing.currentVersion + 1;
    const title = data.title || existing.title;
    const description = data.description !== undefined ? data.description : existing.description;
    const subject = data.subject || existing.subject;
    const settings = data.settings || existing.settings;
    const status = data.status || existing.status;

    // Create new immutable version snapshot if questions are provided
    if (data.questions && Array.isArray(data.questions)) {
      const updated = await this.prisma.quiz.update({
        where: { id },
        data: {
          title,
          description,
          subject,
          status,
          settings,
          currentVersion: nextVersionNumber,
          versions: {
            create: {
              versionNumber: nextVersionNumber,
              title,
              description,
              settings,
              questions: {
                create: data.questions.map((q: any, idx: number) => ({
                  questionIndex: idx + 1,
                  text: q.text,
                  explanation: q.explanation || null,
                  hasMath: Boolean(q.hasMath),
                  hasChemistry: Boolean(q.hasChemistry),
                  points: q.points || 1,
                  options: {
                    create: (q.options || []).map((opt: any, optIdx: number) => ({
                      optionIndex: optIdx,
                      text: opt.text,
                      isCorrect: Boolean(opt.isCorrect),
                    })),
                  },
                })),
              },
            },
          },
        },
      });
      return updated;
    } else {
      // Just update metadata
      const updated = await this.prisma.quiz.update({
        where: { id },
        data: {
          title,
          description,
          subject,
          status,
          settings,
        },
      });
      return updated;
    }
  }

  async duplicateQuiz(id: string, userId: string) {
    const source = await this.prisma.quiz.findUnique({
      where: { id },
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

    if (!source) throw new NotFoundException('Test topilmadi');

    const sourceVer = source.versions[0];
    const newQuiz = await this.prisma.quiz.create({
      data: {
        title: `${source.title} (Nusxa)`,
        description: source.description,
        subject: source.subject,
        creatorId: userId,
        status: QuizStatus.DRAFT,
        currentVersion: 1,
        settings: source.settings || undefined,
        versions: {
          create: {
            versionNumber: 1,
            title: `${source.title} (Nusxa)`,
            description: source.description,
            settings: source.settings || undefined,
            questions: {
              create: sourceVer
                ? sourceVer.questions.map((q) => ({
                    questionIndex: q.questionIndex,
                    text: q.text,
                    explanation: q.explanation,
                    hasMath: q.hasMath,
                    hasChemistry: q.hasChemistry,
                    points: q.points,
                    options: {
                      create: q.options.map((opt) => ({
                        optionIndex: opt.optionIndex,
                        text: opt.text,
                        isCorrect: opt.isCorrect,
                      })),
                    },
                  }))
                : [],
            },
          },
        },
      },
    });

    return newQuiz;
  }

  async deleteQuiz(id: string, userId: string, role: UserRole) {
    const existing = await this.prisma.quiz.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Test topilmadi');
    if (role !== UserRole.SUPER_ADMIN && existing.creatorId !== userId) {
      throw new ForbiddenException('O‘chirishga ruxsat yo‘q');
    }

    await this.prisma.quiz.delete({ where: { id } });
    return { success: true, message: 'Test o‘chirildi' };
  }
}
