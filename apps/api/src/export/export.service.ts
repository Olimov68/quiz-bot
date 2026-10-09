import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import {
  generateQuizExcelReport,
  ExcelExportData,
  GeneralResultRow,
  DetailedAnswerRow,
  QuestionStatRow,
} from '@smart-quiz/quiz-engine';

@Injectable()
export class ExportService {
  constructor(private prisma: PrismaService) {}

  async exportSessionToExcel(sessionId: string): Promise<{ buffer: Buffer; filename: string }> {
    const session = await this.prisma.quizSession.findUnique({
      where: { id: sessionId },
      include: {
        group: true,
        quizVersion: {
          include: {
            questions: {
              orderBy: { questionIndex: 'asc' },
              include: { options: true },
            },
          },
        },
        participants: {
          include: { user: true },
        },
        pollInstances: {
          include: {
            question: { include: { options: true } },
            answers: { include: { user: true } },
          },
        },
      },
    });

    if (!session) throw new NotFoundException('Sessiya topilmadi');

    const quizTitle = session.quizVersion.title;
    const groupName = session.group?.title || 'Umumiy';
    const totalQuestions = session.quizVersion.questions.length;

    // Sheet 1: General Results
    const generalResults: GeneralResultRow[] = session.participants.map((p, idx) => {
      const tgSnap = p.telegramUserSnapshot as any;
      const fullName =
        tgSnap?.first_name ||
        `${p.user.firstName} ${p.user.lastName || ''}`.trim() ||
        'Qatnashchi';

      const correct = p.totalCorrect;
      const totalAns = p.totalAnswered;
      const incorrect = totalAns - correct;
      const unanswered = Math.max(0, totalQuestions - totalAns);
      const percentage = totalQuestions > 0 ? (p.score / totalQuestions) * 100 : 0;
      const timeSpentSeconds = Number(p.totalTimeMs) / 1000;

      return {
        index: idx + 1,
        fullName,
        telegramId: p.user.telegramId.toString(),
        quizTitle,
        groupName,
        totalQuestions,
        correctAnswers: correct,
        incorrectAnswers: incorrect,
        unansweredQuestions: unanswered,
        score: p.score,
        percentage,
        timeSpentSeconds,
        startedAt: p.joinedAt.toLocaleString('uz-UZ'),
        completedAt: p.completedAt ? p.completedAt.toLocaleString('uz-UZ') : '-',
      };
    });

    // Sheet 2: Detailed Answers
    const detailedAnswers: DetailedAnswerRow[] = [];
    for (const poll of session.pollInstances) {
      const q = poll.question;
      const correctOption = q.options.find((o) => o.isCorrect)?.text || '-';

      for (const ans of poll.answers) {
        const participantName =
          `${ans.user.firstName} ${ans.user.lastName || ''}`.trim() || 'Qatnashchi';
        const selectedIdx = Array.isArray(ans.selectedOptions)
          ? (ans.selectedOptions as number[])[0]
          : 0;
        const selectedOptText = q.options[selectedIdx]?.text || '-';

        detailedAnswers.push({
          participantName,
          questionNumber: q.questionIndex,
          questionText: q.text,
          selectedOption: selectedOptText,
          correctOption,
          isCorrect: ans.isCorrect,
          timeSpentSeconds: ans.responseTimeMs / 1000,
        });
      }
    }

    // Sheet 3: Question-level Statistics
    const questionStats: QuestionStatRow[] = session.quizVersion.questions.map((q) => {
      const matchingPolls = session.pollInstances.filter((pi) => pi.questionId === q.id);
      let correctCount = 0;
      let totalAnswered = 0;

      matchingPolls.forEach((pi) => {
        pi.answers.forEach((ans) => {
          totalAnswered++;
          if (ans.isCorrect) correctCount++;
        });
      });

      const correctPercentage = totalAnswered > 0 ? (correctCount / totalAnswered) * 100 : 0;

      return {
        questionNumber: q.questionIndex,
        questionText: q.text,
        correctCount,
        totalAnswered,
        correctPercentage,
      };
    });

    const exportData: ExcelExportData = {
      quizTitle,
      groupName,
      generalResults,
      detailedAnswers,
      questionStats,
    };

    const buffer = await generateQuizExcelReport(exportData);
    const sanitizedTitle = quizTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Natijalar_${sanitizedTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return { buffer, filename };
  }
}
