import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Bot, InlineKeyboard, Keyboard, InputFile } from 'grammy';
import { PrismaService } from '../database/prisma.service.js';
import { loadConfig, AppConfig } from '../config/configuration.js';
import { parseDocxBuffer } from '@smart-quiz/docx-parser';
import {
  buildTelegramQuizPoll,
  calculateLeaderboard,
  formatUzbekLeaderboardMessage,
  generateQuizExcelReport,
} from '@smart-quiz/quiz-engine';
import {
  UZ_MENUS,
  UZ_MESSAGES,
  UserRole,
  QuizStatus,
  QuizSessionMode,
  SessionStatus,
  IssueSeverity,
} from '@smart-quiz/shared';

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: Bot | null = null;
  private config: AppConfig;
  private userStates = new Map<string, { step: string; data?: any }>();
  private activeTimers = new Map<string, NodeJS.Timeout>();

  constructor(private prisma: PrismaService) {
    this.config = loadConfig();
  }

  async onModuleInit() {
    if (!this.config.botToken || this.config.botToken.includes('123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ')) {
      this.logger.warn(
        '⚠️ Telegram BOT_TOKEN haqiqiy token emas yoki belgilanmagan. Bot faqat simulyatsiya/API rejimida ishlaydi. Iltimos .env faylida BOT_TOKEN ni sozlang.'
      );
      return;
    }

    try {
      this.bot = new Bot(this.config.botToken);
      this.registerHandlers();

      if (!this.config.telegramWebhookUrl) {
        this.logger.log('🚀 Telegram bot Long Polling rejimida ishga tushirilmoqda...');
        this.bot.start({
          onStart: (botInfo) => {
            this.logger.log(`✅ Telegram bot muvaffaqiyatli ulandi: @${botInfo.username}`);
          },
        });
      } else {
        this.logger.log(`🌐 Telegram bot Webhook rejimida: ${this.config.telegramWebhookUrl}`);
      }
    } catch (err: any) {
      this.logger.error(`❌ Telegram botni ishga tushirishda xatolik: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    if (this.bot) {
      this.logger.log('🛑 Telegram bot to‘xtatilmoqda...');
      await this.bot.stop();
    }
    for (const timer of this.activeTimers.values()) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
  }

  public getBot(): Bot | null {
    return this.bot;
  }

  private registerHandlers() {
    if (!this.bot) return;

    // 1. /start command
    this.bot.command('start', async (ctx) => {
      const from = ctx.from;
      if (!from) return;

      const user = await this.upsertTelegramUser(from);
      const text = ctx.match; // Payload from deep link: e.g. /start quiz_123

      if (text && text.startsWith('quiz_')) {
        const quizId = text.replace('quiz_', '');
        await this.handleIndividualQuizStart(ctx, user, quizId);
        return;
      }

      const mainKeyboard = new Keyboard()
        .text(UZ_MENUS.CREATE_QUIZ)
        .text(UZ_MENUS.MY_QUIZZES)
        .row()
        .text(UZ_MENUS.RESULTS)
        .text(UZ_MENUS.MY_GROUPS)
        .row()
        .text(UZ_MENUS.STATISTICS)
        .text(UZ_MENUS.PROFILE)
        .row()
        .text(UZ_MENUS.SETTINGS)
        .text(UZ_MENUS.HELP)
        .resized();

      const inlineKeyboard = new InlineKeyboard().webApp(
        '🌐 Veb Panelni Ochish',
        this.config.publicWebUrl
      );

      await ctx.reply(UZ_MESSAGES.WELCOME(from.first_name), {
        parse_mode: 'HTML',
        reply_markup: mainKeyboard,
      });

      await ctx.reply('Quyidagi tugma orqali boshqaruv paneliga to‘g‘ridan-to‘g‘ri kirishingiz mumkin:', {
        reply_markup: inlineKeyboard,
      });
    });

    // 2. /help command
    this.bot.command('help', async (ctx) => {
      await ctx.reply(UZ_MESSAGES.HELP, { parse_mode: 'HTML' });
    });

    // 3. /cancel command
    this.bot.command('cancel', async (ctx) => {
      if (ctx.from) {
        this.userStates.delete(ctx.from.id.toString());
      }
      await ctx.reply(UZ_MESSAGES.OPERATION_CANCELLED);
    });

    // 4. Menu Buttons
    this.bot.hears(UZ_MENUS.CREATE_QUIZ, async (ctx) => {
      if (!ctx.from) return;
      this.userStates.set(ctx.from.id.toString(), { step: 'awaiting_quiz_title' });
      await ctx.reply(UZ_MESSAGES.CREATE_TITLE_PROMPT, { parse_mode: 'HTML' });
    });

    this.bot.hears(UZ_MENUS.MY_QUIZZES, async (ctx) => {
      if (!ctx.from) return;
      await this.showUserQuizzes(ctx);
    });

    this.bot.hears(UZ_MENUS.RESULTS, async (ctx) => {
      if (!ctx.from) return;
      await this.showUserResults(ctx);
    });

    this.bot.hears(UZ_MENUS.STATISTICS, async (ctx) => {
      if (!ctx.from) return;
      await this.showUserStats(ctx);
    });

    this.bot.hears(UZ_MENUS.PROFILE, async (ctx) => {
      if (!ctx.from) return;
      await this.showUserProfile(ctx);
    });

    this.bot.hears(UZ_MENUS.HELP, async (ctx) => {
      await ctx.reply(UZ_MESSAGES.HELP, { parse_mode: 'HTML' });
    });

    // 5. Document upload handler (Word .docx files)
    this.bot.on('message:document', async (ctx) => {
      const doc = ctx.message.document;
      const fileName = doc.file_name || '';

      if (!fileName.toLowerCase().endsWith('.docx')) {
        await ctx.reply(UZ_MESSAGES.FILE_INVALID_TYPE);
        return;
      }

      if (doc.file_size && doc.file_size > this.config.maxDocxSizeMb * 1024 * 1024) {
        await ctx.reply(UZ_MESSAGES.FILE_TOO_LARGE);
        return;
      }

      const progressMsg = await ctx.reply(UZ_MESSAGES.FILE_PROCESSING);

      try {
        const file = await ctx.getFile();
        const fileUrl = `https://api.telegram.org/file/bot${this.config.botToken}/${file.file_path}`;

        // Download document buffer
        const response = await fetch(fileUrl);
        const arrayBuf = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);

        // Parse docx
        const parseResult = await parseDocxBuffer(buffer);

        if (!parseResult.success || parseResult.questions.length === 0) {
          const errMsg = parseResult.globalIssues[0]?.message || 'Fayldan savollar aniqlanmadi';
          await ctx.api.editMessageText(
            ctx.chat.id,
            progressMsg.message_id,
            `❌ <b>Tahlil xatosi:</b> ${errMsg}`,
            { parse_mode: 'HTML' }
          );
          return;
        }

        const user = await this.upsertTelegramUser(ctx.from!);
        const state = this.userStates.get(ctx.from!.id.toString());
        const quizTitle = state?.data?.title || fileName.replace(/\.docx$/i, '');

        // Save Quiz to database
        const quiz = await this.prisma.quiz.create({
          data: {
            title: quizTitle,
            creatorId: user.id,
            status: QuizStatus.PUBLISHED,
            currentVersion: 1,
            versions: {
              create: {
                versionNumber: 1,
                title: quizTitle,
                questions: {
                  create: parseResult.questions.map((q) => ({
                    questionIndex: q.index,
                    text: q.text,
                    explanation: q.explanation || null,
                    hasMath: q.hasMath,
                    hasChemistry: q.hasChemistry,
                    points: 1,
                    options: {
                      create: q.options.map((opt) => ({
                        optionIndex: opt.index,
                        text: opt.text,
                        isCorrect: opt.isCorrect,
                      })),
                    },
                  })),
                },
              },
            },
          },
        });

        // Clear state
        this.userStates.delete(ctx.from!.id.toString());

        // Report summary
        const summaryText = UZ_MESSAGES.IMPORT_SUCCESS({
          title: quizTitle,
          total: parseResult.totalQuestions,
          valid: parseResult.validQuestions,
          needsCheck: parseResult.invalidQuestions,
          images: parseResult.imagesCount,
          formulas: parseResult.formulasCount,
        });

        const keyboard = new InlineKeyboard()
          .text('🚀 Guruhda boshlash', `start_group_${quiz.id}`)
          .row()
          .webApp('🌐 Vebda ko‘rish', `${this.config.publicWebUrl}/dashboard/quizzes/${quiz.id}`)
          .row()
          .text('🗑 O‘chirish', `delete_quiz_${quiz.id}`);

        await ctx.api.editMessageText(ctx.chat.id, progressMsg.message_id, summaryText, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
      } catch (err: any) {
        this.logger.error(`DOCX yuklashda xatolik: ${err.message}`);
        await ctx.api.editMessageText(
          ctx.chat.id,
          progressMsg.message_id,
          `❌ <b>Faylni qayta ishlashda xatolik yuz berdi:</b> ${err.message}`,
          { parse_mode: 'HTML' }
        );
      }
    });

    // 6. Text message router (conversations)
    this.bot.on('message:text', async (ctx) => {
      const from = ctx.from;
      if (!from) return;
      const state = this.userStates.get(from.id.toString());
      if (!state) return;

      if (state.step === 'awaiting_quiz_title') {
        const title = ctx.message.text.trim();
        this.userStates.set(from.id.toString(), {
          step: 'awaiting_docx_file',
          data: { title },
        });
        await ctx.reply(UZ_MESSAGES.CREATE_FILE_PROMPT, { parse_mode: 'HTML' });
      }
    });

    // 7. Callback query handlers (Inline button clicks)
    this.bot.on('callback_query:data', async (ctx) => {
      const data = ctx.callbackQuery.data;
      const user = await this.upsertTelegramUser(ctx.from);

      // Join Quiz Session in Group
      if (data.startsWith('join_session_')) {
        const sessionId = data.replace('join_session_', '');
        await this.handleJoinSession(ctx, user, sessionId);
        return;
      }

      // Start Quiz Session in Group
      if (data.startsWith('launch_session_')) {
        const sessionId = data.replace('launch_session_', '');
        await this.handleLaunchSession(ctx, user, sessionId);
        return;
      }

      // Start Group Session prompt
      if (data.startsWith('start_group_')) {
        const quizId = data.replace('start_group_', '');
        await this.promptStartGroupSession(ctx, quizId);
        return;
      }

      // Excel Report download
      if (data.startsWith('excel_report_')) {
        const sessionId = data.replace('excel_report_', '');
        await this.handleSendExcelReport(ctx, sessionId);
        return;
      }

      await ctx.answerCallbackQuery();
    });

    // 8. poll_answer listener (Native Telegram Quiz Poll answers)
    this.bot.on('poll_answer', async (ctx) => {
      await this.handlePollAnswer(ctx);
    });
  }

  // --- Handlers & Helpers ---

  private async upsertTelegramUser(from: any) {
    const isSuperAdmin = this.config.superAdminTelegramIds.includes(from.id.toString());
    return this.prisma.user.upsert({
      where: { telegramId: BigInt(from.id) },
      update: {
        username: from.username || null,
        firstName: from.first_name || 'Foydalanuvchi',
        lastName: from.last_name || null,
      },
      create: {
        telegramId: BigInt(from.id),
        username: from.username || null,
        firstName: from.first_name || 'Foydalanuvchi',
        lastName: from.last_name || null,
        role: isSuperAdmin ? UserRole.SUPER_ADMIN : UserRole.TEACHER,
      },
    });
  }

  private async showUserQuizzes(ctx: any) {
    const user = await this.upsertTelegramUser(ctx.from!);
    const quizzes = await this.prisma.quiz.findMany({
      where: { creatorId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        versions: {
          take: 1,
          orderBy: { versionNumber: 'desc' },
          include: { _count: { select: { questions: true } } },
        },
      },
    });

    if (quizzes.length === 0) {
      await ctx.reply(
        `📚 Sizda hali yaratilgan testlar mavjud emas.\n\n«➕ Test yaratish» tugmasini bosib birinchi testingizni yarating!`
      );
      return;
    }

    let text = `📚 <b>Sizning testlaringiz:</b>\n\n`;
    const keyboard = new InlineKeyboard();

    quizzes.forEach((q, idx) => {
      const qCount = q.versions[0]?._count?.questions || 0;
      text += `${idx + 1}. <b>${q.title}</b> (${qCount} ta savol)\n`;
      keyboard.text(`🚀 ${q.title.slice(0, 20)}`, `start_group_${q.id}`).row();
    });

    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
  }

  private async showUserResults(ctx: any) {
    const user = await this.upsertTelegramUser(ctx.from!);
    const sessions = await this.prisma.quizSession.findMany({
      where: { createdById: user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        quizVersion: true,
        _count: { select: { participants: true } },
      },
    });

    if (sessions.length === 0) {
      await ctx.reply('🏆 Sizda hali o‘tkazilgan test natijalari mavjud emas.');
      return;
    }

    let text = `🏆 <b>Oxirgi o‘tkazilgan test sessiyalari:</b>\n\n`;
    const keyboard = new InlineKeyboard();

    sessions.forEach((s, idx) => {
      text += `${idx + 1}. <b>${s.quizVersion.title}</b>\n`;
      text += `   👥 Qatnashchilar: ${s._count.participants} ta | Holat: ${s.status}\n\n`;
      keyboard.text(`📊 Hisobot #${idx + 1}`, `excel_report_${s.id}`).row();
    });

    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
  }

  private async showUserStats(ctx: any) {
    const user = await this.upsertTelegramUser(ctx.from!);
    const attempts = await this.prisma.quizAttempt.findMany({
      where: { userId: user.id },
    });

    const quizzesCount = attempts.length;
    const totalCorrect = attempts.reduce((acc, a) => acc + a.totalCorrect, 0);
    const totalIncorrect = attempts.reduce((acc, a) => acc + a.totalIncorrect, 0);
    const avgScore = quizzesCount > 0 ? attempts.reduce((acc, a) => acc + a.percentage, 0) / quizzesCount : 0;
    const bestScore = quizzesCount > 0 ? Math.max(...attempts.map((a) => a.percentage)) : 0;

    const text = UZ_MESSAGES.STUDENT_PROFILE({
      name: ctx.from.first_name,
      quizzesCount,
      correctAnswers: totalCorrect,
      wrongAnswers: totalIncorrect,
      averageScore: avgScore,
      bestScore,
    });

    await ctx.reply(text, { parse_mode: 'HTML' });
  }

  private async showUserProfile(ctx: any) {
    const user = await this.upsertTelegramUser(ctx.from!);
    let text = `👤 <b>Sizning profilingiz:</b>\n\n`;
    text += `🆔 Telegram ID: <code>${user.telegramId}</code>\n`;
    text += `👤 Ism: <b>${user.firstName} ${user.lastName || ''}</b>\n`;
    if (user.username) text += `🔹 Username: @${user.username}\n`;
    text += `🎖 Rol: <b>${user.role}</b>\n`;

    const inlineKeyboard = new InlineKeyboard().webApp(
      '🌐 Boshqaruv Panelini Ochish',
      this.config.publicWebUrl
    );

    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: inlineKeyboard });
  }

  private async promptStartGroupSession(ctx: any, quizId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: { versions: { take: 1, orderBy: { versionNumber: 'desc' } } },
    });
    if (!quiz) return;

    await ctx.answerCallbackQuery();
    await ctx.reply(
      `📌 <b>Testni guruhda o‘tkazish uchun:</b>\n\n` +
      `1. Botni guruhingizga qo‘shing va xabar yuborish huquqini bering.\n` +
      `2. Guruhingizda quyidagi buyruqni yozing:\n\n` +
      `<code>/startquiz ${quiz.id}</code>`,
      { parse_mode: 'HTML' }
    );
  }

  /**
   * Group Quiz Start (/startquiz <quizId>)
   */
  public async handleStartQuizInGroup(ctx: any, quizId: string) {
    if (!this.bot) return;
    const user = await this.upsertTelegramUser(ctx.from);

    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        versions: {
          take: 1,
          orderBy: { versionNumber: 'desc' },
          include: {
            questions: {
              orderBy: { questionIndex: 'asc' },
              include: { options: true },
            },
          },
        },
      },
    });

    if (!quiz || quiz.versions.length === 0) {
      await ctx.reply('❌ Test topilmadi');
      return;
    }

    const version = quiz.versions[0];
    const questionsCount = version.questions.length;
    const timePerQuestion = (quiz.settings as any)?.timeLimitPerQuestionSeconds || 30;

    // Create QuizSession in DB
    const session = await this.prisma.quizSession.create({
      data: {
        quizVersionId: version.id,
        createdById: user.id,
        telegramChatId: BigInt(ctx.chat.id),
        mode: QuizSessionMode.LIVE_GROUP,
        status: SessionStatus.WAITING_PARTICIPANTS,
        settingsSnapshot: quiz.settings || undefined,
      },
    });

    const lobbyText = UZ_MESSAGES.GROUP_QUIZ_WAITING({
      title: quiz.title,
      participantsCount: 0,
      questionsCount,
      timePerQuestion,
    });

    const keyboard = new InlineKeyboard()
      .text(UZ_MENUS.JOIN_QUIZ, `join_session_${session.id}`)
      .row()
      .text(UZ_MENUS.START_QUIZ, `launch_session_${session.id}`);

    await ctx.reply(lobbyText, { parse_mode: 'HTML', reply_markup: keyboard });
  }

  private async handleJoinSession(ctx: any, user: any, sessionId: string) {
    const session = await this.prisma.quizSession.findUnique({
      where: { id: sessionId },
      include: {
        quizVersion: true,
        participants: true,
      },
    });

    if (!session || session.status !== SessionStatus.WAITING_PARTICIPANTS) {
      await ctx.answerCallbackQuery({ text: 'Test allaqachon boshlangan yoki yakunlangan!', show_alert: true });
      return;
    }

    await this.prisma.sessionParticipant.upsert({
      where: {
        sessionId_userId: { sessionId, userId: user.id },
      },
      update: {},
      create: {
        sessionId,
        userId: user.id,
        telegramUserSnapshot: ctx.from,
        score: 0,
        totalAnswered: 0,
        totalCorrect: 0,
      },
    });

    const updatedParticipantsCount = await this.prisma.sessionParticipant.count({
      where: { sessionId },
    });

    await ctx.answerCallbackQuery({ text: 'Siz ro‘yxatga olindingiz! ✅' });

    // Update lobby message count
    const timePerQuestion = (session.settingsSnapshot as any)?.timeLimitPerQuestionSeconds || 30;
    const questionsCount = await this.prisma.question.count({
      where: { quizVersionId: session.quizVersionId },
    });

    const updatedLobbyText = UZ_MESSAGES.GROUP_QUIZ_WAITING({
      title: session.quizVersion.title,
      participantsCount: updatedParticipantsCount,
      questionsCount,
      timePerQuestion,
    });

    const keyboard = new InlineKeyboard()
      .text(UZ_MENUS.JOIN_QUIZ, `join_session_${session.id}`)
      .row()
      .text(UZ_MENUS.START_QUIZ, `launch_session_${session.id}`);

    try {
      await ctx.editMessageText(updatedLobbyText, { parse_mode: 'HTML', reply_markup: keyboard });
    } catch {}
  }

  private async handleLaunchSession(ctx: any, user: any, sessionId: string) {
    const session = await this.prisma.quizSession.findUnique({
      where: { id: sessionId },
      include: {
        quizVersion: {
          include: {
            questions: {
              orderBy: { questionIndex: 'asc' },
              include: { options: true },
            },
          },
        },
      },
    });

    if (!session) return;
    if (session.createdById !== user.id && user.role !== UserRole.SUPER_ADMIN) {
      await ctx.answerCallbackQuery({ text: 'Faqat test tashkilotchisi testni boshlashi mumkin!', show_alert: true });
      return;
    }

    await ctx.answerCallbackQuery({ text: 'Test boshlanmoqda! 🚀' });

    await this.prisma.quizSession.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.ACTIVE,
        startedAt: new Date(),
        currentQuestionIndex: 0,
      },
    });

    await ctx.reply('🚀 <b>Test boshlandi! Diqqat, 1-savol:</b>', { parse_mode: 'HTML' });

    // Send question 0
    await this.dispatchQuestion(session.id, 0);
  }

  private async dispatchQuestion(sessionId: string, questionIndex: number) {
    if (!this.bot) return;

    const session = await this.prisma.quizSession.findUnique({
      where: { id: sessionId },
      include: {
        quizVersion: {
          include: {
            questions: {
              orderBy: { questionIndex: 'asc' },
              include: { options: true },
            },
          },
        },
      },
    });

    if (!session || !session.telegramChatId) return;

    const questions = session.quizVersion.questions;
    if (questionIndex >= questions.length) {
      // All questions completed!
      await this.finalizeQuizSession(sessionId);
      return;
    }

    const q = questions[questionIndex];
    const timeLimit = (session.settingsSnapshot as any)?.timeLimitPerQuestionSeconds || 30;

    const pollData = buildTelegramQuizPoll(
      {
        index: q.questionIndex,
        text: q.text,
        explanation: q.explanation || undefined,
        options: q.options.map((o) => ({
          index: o.optionIndex,
          letter: String.fromCharCode(65 + o.optionIndex),
          text: o.text,
          isCorrect: o.isCorrect,
        })),
        hasMath: q.hasMath,
        hasChemistry: q.hasChemistry,
        formulas: [],
        images: [],
        issues: [],
      },
      timeLimit,
      false
    );

    const chatId = Number(session.telegramChatId);

    // If companion message exists (e.g. text > 300 chars or math/chemistry card)
    if (pollData.companionMessage) {
      await this.bot.api.sendMessage(chatId, pollData.companionMessage, { parse_mode: 'HTML' });
    }

    // Send native Telegram Quiz Poll!
    const pollMsg = await this.bot.api.sendPoll(chatId, pollData.question, pollData.options, {
      type: 'quiz',
      is_anonymous: false,
      correct_option_id: pollData.correct_option_id,
      explanation: pollData.explanation,
      open_period: pollData.open_period,
    } as any);

    // Save PollInstance in database
    await this.prisma.pollInstance.create({
      data: {
        sessionId,
        questionId: q.id,
        telegramPollId: pollMsg.poll.id,
        messageId: pollMsg.message_id,
        chatId: session.telegramChatId,
        correctOptionId: pollData.correct_option_id,
        isOpen: true,
        expiresAt: timeLimit > 0 ? new Date(Date.now() + timeLimit * 1000) : null,
      },
    });

    await this.prisma.quizSession.update({
      where: { id: sessionId },
      data: { currentQuestionIndex: questionIndex },
    });

    // Schedule next question progression
    if (timeLimit > 0) {
      const timerKey = `timer_${sessionId}_${questionIndex}`;
      const timer = setTimeout(async () => {
        this.activeTimers.delete(timerKey);
        try {
          // Close poll if still open
          await this.bot?.api.stopPoll(chatId, pollMsg.message_id);
        } catch {}
        // Dispatch next question
        await this.dispatchQuestion(sessionId, questionIndex + 1);
      }, (timeLimit + 2) * 1000);

      this.activeTimers.set(timerKey, timer);
    }
  }

  private async handlePollAnswer(ctx: any) {
    const pollAnswer = ctx.pollAnswer;
    const pollId = pollAnswer.poll_id;
    const tgUser = pollAnswer.user;
    const selectedOptionIds = pollAnswer.option_ids;

    const pollInstance = await this.prisma.pollInstance.findUnique({
      where: { telegramPollId: pollId },
      include: { session: true },
    });

    if (!pollInstance) return;

    const user = await this.upsertTelegramUser(tgUser);
    const isCorrect = selectedOptionIds.includes(pollInstance.correctOptionId);
    const responseTimeMs = Math.max(0, Date.now() - pollInstance.sentAt.getTime());

    // Record answer
    await this.prisma.pollAnswer.upsert({
      where: {
        pollInstanceId_userId: { pollInstanceId: pollInstance.id, userId: user.id },
      },
      update: {
        selectedOptions: selectedOptionIds,
        isCorrect,
        responseTimeMs,
      },
      create: {
        pollInstanceId: pollInstance.id,
        userId: user.id,
        telegramPollId: pollId,
        selectedOptions: selectedOptionIds,
        isCorrect,
        responseTimeMs,
      },
    });

    // Update participant score
    await this.prisma.sessionParticipant.upsert({
      where: {
        sessionId_userId: { sessionId: pollInstance.sessionId, userId: user.id },
      },
      update: {
        score: { increment: isCorrect ? 1 : 0 },
        totalAnswered: { increment: 1 },
        totalCorrect: { increment: isCorrect ? 1 : 0 },
        totalTimeMs: { increment: BigInt(responseTimeMs) },
      },
      create: {
        sessionId: pollInstance.sessionId,
        userId: user.id,
        score: isCorrect ? 1 : 0,
        totalAnswered: 1,
        totalCorrect: isCorrect ? 1 : 0,
        totalTimeMs: BigInt(responseTimeMs),
      },
    });
  }

  private async finalizeQuizSession(sessionId: string) {
    if (!this.bot) return;

    const session = await this.prisma.quizSession.findUnique({
      where: { id: sessionId },
      include: {
        quizVersion: {
          include: { questions: true },
        },
        participants: {
          include: { user: true },
        },
      },
    });

    if (!session || !session.telegramChatId) return;

    await this.prisma.quizSession.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    const totalQuestions = session.quizVersion.questions.length;
    const participantsInput = session.participants.map((p) => ({
      userId: p.userId,
      telegramId: p.user.telegramId.toString(),
      displayName: `${p.user.firstName} ${p.user.lastName || ''}`.trim(),
      username: p.user.username,
      score: p.score,
      totalQuestions,
      totalTimeMs: Number(p.totalTimeMs),
      joinTimestamp: p.joinedAt.getTime(),
    }));

    const leaderboard = calculateLeaderboard(participantsInput);
    const leaderboardMsg = formatUzbekLeaderboardMessage(
      session.quizVersion.title,
      totalQuestions,
      leaderboard
    );

    const keyboard = new InlineKeyboard()
      .text('📥 Excel Hisobot', `excel_report_${session.id}`)
      .webApp('🌐 Veb Natijalar', `${this.config.publicWebUrl}/dashboard/sessions/${session.id}`);

    await this.bot.api.sendMessage(Number(session.telegramChatId), leaderboardMsg, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }

  private async handleSendExcelReport(ctx: any, sessionId: string) {
    await ctx.answerCallbackQuery({ text: 'Hisobot tayyorlanmoqda... ⏳' });

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

    if (!session) return;

    const totalQuestions = session.quizVersion.questions.length;
    const generalResults = session.participants.map((p, idx) => ({
      index: idx + 1,
      fullName: `${p.user.firstName} ${p.user.lastName || ''}`.trim(),
      telegramId: p.user.telegramId.toString(),
      quizTitle: session.quizVersion.title,
      groupName: session.group?.title || 'Umumiy',
      totalQuestions,
      correctAnswers: p.totalCorrect,
      incorrectAnswers: p.totalAnswered - p.totalCorrect,
      unansweredQuestions: Math.max(0, totalQuestions - p.totalAnswered),
      score: p.score,
      percentage: totalQuestions > 0 ? (p.score / totalQuestions) * 100 : 0,
      timeSpentSeconds: Number(p.totalTimeMs) / 1000,
      startedAt: p.joinedAt.toLocaleString('uz-UZ'),
      completedAt: p.completedAt ? p.completedAt.toLocaleString('uz-UZ') : '-',
    }));

    const detailedAnswers: any[] = [];
    for (const poll of session.pollInstances) {
      const q = poll.question;
      const correctOption = q.options.find((o) => o.isCorrect)?.text || '-';
      for (const ans of poll.answers) {
        const participantName = `${ans.user.firstName} ${ans.user.lastName || ''}`.trim();
        const selectedIdx = Array.isArray(ans.selectedOptions) ? (ans.selectedOptions as number[])[0] : 0;
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

    const questionStats = session.quizVersion.questions.map((q) => {
      const matchingPolls = session.pollInstances.filter((pi) => pi.questionId === q.id);
      let correctCount = 0;
      let totalAnswered = 0;
      matchingPolls.forEach((pi) => {
        pi.answers.forEach((ans) => {
          totalAnswered++;
          if (ans.isCorrect) correctCount++;
        });
      });
      return {
        questionNumber: q.questionIndex,
        questionText: q.text,
        correctCount,
        totalAnswered,
        correctPercentage: totalAnswered > 0 ? (correctCount / totalAnswered) * 100 : 0,
      };
    });

    const buffer = await generateQuizExcelReport({
      quizTitle: session.quizVersion.title,
      groupName: session.group?.title || 'Umumiy',
      generalResults,
      detailedAnswers,
      questionStats,
    });

    const file = new InputFile(buffer, `Natijalar_${session.quizVersion.title.replace(/\s+/g, '_')}.xlsx`);
    await ctx.replyWithDocument(file, {
      caption: `📊 <b>${session.quizVersion.title}</b> testi bo‘yicha to‘liq Excel hisoboti.`,
      parse_mode: 'HTML',
    });
  }

  private async handleIndividualQuizStart(ctx: any, user: any, quizId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        versions: {
          take: 1,
          orderBy: { versionNumber: 'desc' },
          include: { questions: { include: { options: true } } },
        },
      },
    });

    if (!quiz || quiz.versions.length === 0) {
      await ctx.reply('❌ Test topilmadi');
      return;
    }

    const version = quiz.versions[0];
    const session = await this.prisma.quizSession.create({
      data: {
        quizVersionId: version.id,
        createdById: user.id,
        mode: QuizSessionMode.INDIVIDUAL,
        status: SessionStatus.ACTIVE,
        telegramChatId: BigInt(ctx.chat.id),
      },
    });

    await ctx.reply(
      `📚 <b>${quiz.title}</b>\n\n` +
      `Siz individual test rejimini boshladingiz. Savollar ketma-ket yuboriladi!`,
      { parse_mode: 'HTML' }
    );

    await this.dispatchQuestion(session.id, 0);
  }
}
