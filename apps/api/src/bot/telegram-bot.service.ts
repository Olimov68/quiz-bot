import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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
} from '@smart-quiz/shared';
import { QuizQueueService, PollTimerJobData } from '../queue/quiz-queue.service.js';

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: Bot | null = null;
  private config: AppConfig;
  private userStates = new Map<string, { step: string; data?: any }>();
  private activeTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private prisma: PrismaService,
    private quizQueueService: QuizQueueService
  ) {
    this.config = loadConfig();
  }

  async onModuleInit() {
    // Register durable timeout handler with queue service
    this.quizQueueService.registerPollTimeoutHandler(async (data) => {
      await this.handleQuestionTimeout(data);
    });

    if (!this.config.botToken || this.config.botToken.includes('123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ')) {
      this.logger.warn(
        '⚠️ Telegram BOT_TOKEN haqiqiy token emas yoki belgilanmagan. Bot API rejimida ishlaydi. Iltimos .env faylida BOT_TOKEN ni sozlang.'
      );
      return;
    }

    try {
      this.bot = new Bot(this.config.botToken);
      this.registerHandlers();

      if (!this.config.telegramWebhookUrl) {
        this.logger.log('🚀 Telegram bot Long Polling rejimida ishga tushirilmoqda...');
        this.bot.start({
          onStart: async (botInfo) => {
            this.logger.log(`✅ Telegram bot muvaffaqiyatli ulandi: @${botInfo.username}`);
            await this.recoverActiveSessions();
            if (this.config.publicWebUrl?.startsWith('https://')) {
              try {
                await this.bot?.api.setChatMenuButton({
                  menu_button: {
                    type: 'web_app',
                    text: '📱 Mini App',
                    web_app: { url: this.config.publicWebUrl },
                  },
                });
                this.logger.log('📱 Telegram Chat Menu Button (Mini App) muvaffaqiyatli sozlandi');
              } catch (e: any) {
                this.logger.warn(`Menu button sozlashda xatolik: ${e.message}`);
              }
            }
          },
        });
      } else {
        this.logger.log(`🌐 Telegram bot Webhook rejimida: ${this.config.telegramWebhookUrl}`);
        await this.recoverActiveSessions();
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

  private getWebDashboardUrl(subPath = ''): { isHttps: boolean; url: string } {
    const raw = (this.config.publicWebUrl || '').trim();
    const cleanBase = raw.endsWith('/') ? raw.slice(0, -1) : raw;
    const fullUrl = subPath ? `${cleanBase}${subPath.startsWith('/') ? '' : '/'}${subPath}` : cleanBase;
    const isHttps = fullUrl.startsWith('https://');
    return { isHttps, url: fullUrl };
  }

  /**
   * Recovers active sessions after process restart so no quiz poll remains stuck.
   */
  private async recoverActiveSessions() {
    try {
      const activeSessions = await this.prisma.quizSession.findMany({
        where: { status: SessionStatus.ACTIVE },
        include: {
          pollInstances: {
            where: { isOpen: true },
            orderBy: { sentAt: 'desc' },
            take: 1,
          },
        },
      });

      for (const session of activeSessions) {
        const activePoll = session.pollInstances[0];
        if (!activePoll || !session.telegramChatId) continue;

        const timeLimit = (session.settingsSnapshot as any)?.timeLimitPerQuestionSeconds ?? 30;
        if (timeLimit > 0 && activePoll.expiresAt) {
          const remainingMs = activePoll.expiresAt.getTime() - Date.now();
          if (remainingMs <= 0) {
            // Already expired while offline -> advance immediately
            await this.handleQuestionTimeout({
              sessionId: session.id,
              questionIndex: session.currentQuestionIndex,
              telegramPollId: activePoll.telegramPollId,
              chatId: Number(session.telegramChatId),
              messageId: activePoll.messageId || undefined,
            });
          } else {
            // Re-schedule remaining time
            const delaySec = Math.ceil(remainingMs / 1000);
            await this.quizQueueService.schedulePollTimeout(
              {
                sessionId: session.id,
                questionIndex: session.currentQuestionIndex,
                telegramPollId: activePoll.telegramPollId,
                chatId: Number(session.telegramChatId),
                messageId: activePoll.messageId || undefined,
              },
              delaySec
            );
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`Sessiyalarni tiklashda ogohlantirish: ${err.message}`);
    }
  }

  private registerHandlers() {
    if (!this.bot) return;

    // 1. /start command
    this.bot.command('start', async (ctx) => {
      const from = ctx.from;
      if (!from) return;

      const user = await this.upsertTelegramUser(from);
      const text = ctx.match;

      if (text && text.startsWith('quiz_')) {
        const quizId = text.replace('quiz_', '');
        await this.handleIndividualQuizStart(ctx, user, quizId);
        return;
      }

      const { isHttps, url: webUrl } = this.getWebDashboardUrl();

      const mainKeyboard = new Keyboard()
        .text(UZ_MENUS.CREATE_QUIZ)
        .text(UZ_MENUS.MY_QUIZZES)
        .row()
        .text(UZ_MENUS.RESULTS)
        .text(UZ_MENUS.MY_GROUPS)
        .row()
        .text(UZ_MENUS.STATISTICS)
        .text(UZ_MENUS.PROFILE)
        .row();

      if (isHttps) {
        mainKeyboard.webApp(UZ_MENUS.OPEN_DASHBOARD, webUrl);
      } else {
        mainKeyboard.text(UZ_MENUS.OPEN_DASHBOARD);
      }

      mainKeyboard.text(UZ_MENUS.HELP).resized();

      await ctx.reply(UZ_MESSAGES.WELCOME(from.first_name), {
        parse_mode: 'HTML',
        reply_markup: mainKeyboard,
      });

      const inlineKeyboard = new InlineKeyboard();
      if (isHttps) {
        inlineKeyboard.webApp('🌐 Veb Panelni Ochish (Mini App)', webUrl);
        await ctx.reply('Quyidagi tugma orqali boshqaruv paneliga to‘g‘ridan-to‘g‘ri kirishingiz mumkin:', {
          reply_markup: inlineKeyboard,
        });
      } else {
        inlineKeyboard.text('ℹ️ Mini App haqida ma’lumot', 'info_mini_app');
        await ctx.reply(
          `💡 <b>Telegram Mini App haqida:</b>\nTelegram qoidasiga ko‘ra, Mini App faqat <b>HTTPS</b> domen orqali ochiladi.\n\nServeringizga domen ulab, <code>.env</code> faylida:\n<code>PUBLIC_WEB_URL=https://sizning-domeningiz.uz</code>\nsozlanganida, ushbu tugma to‘liq ekranli Mini Appni ochadi.\n\nHozirgi manzil: <code>${webUrl || 'sozlanmagan'}</code>`,
          {
            parse_mode: 'HTML',
            reply_markup: inlineKeyboard,
          }
        );
      }
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

    this.bot.hears(UZ_MENUS.OPEN_DASHBOARD, async (ctx) => {
      const { isHttps, url } = this.getWebDashboardUrl();
      if (isHttps) {
        const kb = new InlineKeyboard().webApp('🌐 Mini Appni Ochish', url);
        await ctx.reply('Boshqaruv paneliga kirish uchun quyidagi tugmani bosing:', { reply_markup: kb });
      } else {
        const kb = new InlineKeyboard().text('ℹ️ Mini Appni qanday yoqish mumkin?', 'info_mini_app');
        await ctx.reply(
          '📱 <b>Telegram Mini App haqida:</b>\n\n' +
          'Telegram xavfsizlik talablariga ko‘ra, Mini App faqat <b>HTTPS</b> xavfsiz protokoli orqali ishlaydi.\n\n' +
          'Serveringizga domen ulab, <code>.env</code> faylida:\n' +
          '<code>PUBLIC_WEB_URL=https://sizning-domeningiz.uz</code>\n' +
          'deb sozlaganingizda, ushbu tugma bevosita Telegram ichida to‘liq ekranli Mini Appni ochadi.\n\n' +
          `Hozirgi serverdagi manzil: <code>${url || 'sozlanmagan'}</code>`,
          { parse_mode: 'HTML', reply_markup: kb }
        );
      }
    });

    this.bot.callbackQuery('info_mini_app', async (ctx) => {
      await ctx.answerCallbackQuery();
      await ctx.reply(
        '📱 <b>Mini Appni ulash tartibi:</b>\n\n' +
        '1. Serveringizga domen (masalan: <code>quiz.sizning-sayt.uz</code>) va SSL (Certbot HTTPS) o‘rnating.\n' +
        '2. <code>/opt/quiz-bot/.env</code> faylida:\n' +
        '   <code>PUBLIC_WEB_URL="https://quiz.sizning-sayt.uz"</code> deb yozing.\n' +
        '3. Botni qayta ishga tushiring: <code>sudo systemctl restart quizbot</code>.\n\n' +
        'Shundan so‘ng botda doimiy <b>«Mini App»</b> tugmasi paydo bo‘ladi va veb-panel to‘g‘ridan-to‘g‘ri Telegram ichida ochiladi!',
        { parse_mode: 'HTML' }
      );
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

        // Save extracted images and link to questions
        const savedMediaMap = new Map<string, string>(); // hash -> mediaAssetId
        for (const q of parseResult.questions) {
          for (const img of q.images) {
            if (img.buffer && !savedMediaMap.has(img.hash)) {
              const ext = img.mimeType.split('/').pop() || 'png';
              const filename = `${crypto.randomUUID()}.${ext}`;
              const filePath = path.join(this.config.mediaStoragePath, filename);
              fs.writeFileSync(filePath, img.buffer);

              const mediaRecord = await this.prisma.mediaAsset.create({
                data: {
                  originalName: img.originalName,
                  fileName: filename,
                  mimeType: img.mimeType,
                  sizeBytes: img.buffer.length,
                  path: filePath,
                  url: `/media/${filename}`,
                  ownerId: user.id,
                },
              });
              savedMediaMap.set(img.hash, mediaRecord.id);
            }
          }
        }

        // Save Quiz to database with assets linked
        const quiz = await this.prisma.quiz.create({
          data: {
            title: quizTitle,
            creatorId: user.id,
            status: QuizStatus.PUBLISHED,
            currentVersion: 1,
            settings: {
              timeLimitPerQuestionSeconds: 30,
              shuffleQuestions: false,
              shuffleOptions: false,
              showExplanation: true,
            },
            versions: {
              create: {
                versionNumber: 1,
                title: quizTitle,
                questions: {
                  create: parseResult.questions.map((q) => {
                    const questionMediaIds = q.images
                      .map((img) => savedMediaMap.get(img.hash))
                      .filter(Boolean) as string[];

                    return {
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
                      assets: questionMediaIds.length > 0
                        ? {
                            create: questionMediaIds.map((mediaId) => ({
                              mediaAssetId: mediaId,
                              assetType: 'QUESTION_IMAGE',
                            })),
                          }
                        : undefined,
                    };
                  }),
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

    // 6. Text message router
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

    // 7. Callback query handlers
    this.bot.on('callback_query:data', async (ctx) => {
      const data = ctx.callbackQuery.data;
      const user = await this.upsertTelegramUser(ctx.from);

      if (data.startsWith('join_session_')) {
        const sessionId = data.replace('join_session_', '');
        await this.handleJoinSession(ctx, user, sessionId);
        return;
      }

      if (data.startsWith('launch_session_')) {
        const sessionId = data.replace('launch_session_', '');
        await this.handleLaunchSession(ctx, user, sessionId);
        return;
      }

      if (data.startsWith('next_question_')) {
        const parts = data.replace('next_question_', '').split('_');
        const sessionId = parts[0];
        const nextIdx = parseInt(parts[1], 10);
        await this.handleManualNextQuestion(ctx, user, sessionId, nextIdx);
        return;
      }

      if (data.startsWith('start_group_')) {
        const quizId = data.replace('start_group_', '');
        await this.promptStartGroupSession(ctx, quizId);
        return;
      }

      if (data.startsWith('excel_report_')) {
        const sessionId = data.replace('excel_report_', '');
        await this.handleSendExcelReport(ctx, user, sessionId);
        return;
      }

      await ctx.answerCallbackQuery();
    });

    // 8. poll_answer listener with IDEMPOTENT SCORING
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
      `1. Botni guruhingizga qo‘shing va admin huquqini bering.\n` +
      `2. Guruhingizda quyidagi buyruqni yuboring:\n\n` +
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

    // Authorization check
    if (quiz.creatorId !== user.id && quiz.status !== QuizStatus.PUBLISHED && user.role !== UserRole.SUPER_ADMIN) {
      await ctx.reply('❌ Ushbu testdan foydalanish huquqiga ega emassiz');
      return;
    }

    const version = quiz.versions[0];
    const questionsCount = version.questions.length;
    // FIX: Use nullish coalescing ?? so 0 (untimed) is not overridden with 30!
    const timePerQuestion = (quiz.settings as any)?.timeLimitPerQuestionSeconds ?? 30;

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
    const timePerQuestion = (session.settingsSnapshot as any)?.timeLimitPerQuestionSeconds ?? 30;
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
    await this.dispatchQuestion(session.id, 0);
  }

  private async handleManualNextQuestion(ctx: any, user: any, sessionId: string, nextIdx: number) {
    const session = await this.prisma.quizSession.findUnique({ where: { id: sessionId } });
    if (!session) return;
    if (session.createdById !== user.id && user.role !== UserRole.SUPER_ADMIN) {
      await ctx.answerCallbackQuery({ text: 'Faqat test muallifi savolni o‘tkazishi mumkin!', show_alert: true });
      return;
    }

    await ctx.answerCallbackQuery({ text: 'Keyingi savolga o‘tilmoqda...' });
    await this.dispatchQuestion(sessionId, nextIdx);
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
              include: {
                options: true,
                assets: { include: { mediaAsset: true } },
              },
            },
          },
        },
      },
    });

    if (!session || !session.telegramChatId) return;

    const questions = session.quizVersion.questions;
    if (questionIndex >= questions.length) {
      await this.finalizeQuizSession(sessionId);
      return;
    }

    const q = questions[questionIndex];
    // FIX: Respect untimed tests with ?? 30
    const timeLimit = (session.settingsSnapshot as any)?.timeLimitPerQuestionSeconds ?? 30;

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

    // 1. If question has attached images or diagrams, send photo first!
    if (q.assets && q.assets.length > 0 && q.assets[0].mediaAsset) {
      const media = q.assets[0].mediaAsset;
      if (fs.existsSync(media.path)) {
        try {
          await this.bot.api.sendPhoto(chatId, new InputFile(media.path), {
            caption: `🖼 <b>${q.questionIndex}-savol uchun ilova rasm:</b>`,
            parse_mode: 'HTML',
          });
        } catch (e: any) {
          this.logger.warn(`Rasm yuborishda xatolik: ${e.message}`);
        }
      }
    }

    // 2. If companion message exists (long text, formula card)
    if (pollData.companionMessage) {
      await this.bot.api.sendMessage(chatId, pollData.companionMessage, { parse_mode: 'HTML' });
    }

    // 3. Send native Telegram Quiz Poll!
    const pollMsg = await this.bot.api.sendPoll(chatId, pollData.question, pollData.options, {
      type: 'quiz',
      is_anonymous: false,
      correct_option_id: pollData.correct_option_id,
      explanation: pollData.explanation,
      open_period: pollData.open_period,
    } as any);

    const expiresAt = timeLimit > 0 ? new Date(Date.now() + timeLimit * 1000) : null;

    // Save PollInstance in database with expiration timestamp
    await this.prisma.pollInstance.create({
      data: {
        sessionId,
        questionId: q.id,
        telegramPollId: pollMsg.poll.id,
        messageId: pollMsg.message_id,
        chatId: session.telegramChatId,
        correctOptionId: pollData.correct_option_id,
        isOpen: true,
        expiresAt,
      },
    });

    await this.prisma.quizSession.update({
      where: { id: sessionId },
      data: { currentQuestionIndex: questionIndex },
    });

    // 4. Handle Timers & Progression:
    if (timeLimit > 0) {
      // Schedule durable background queue timeout (BullMQ + DB recovery)
      await this.quizQueueService.schedulePollTimeout(
        {
          sessionId,
          questionIndex,
          telegramPollId: pollMsg.poll.id,
          chatId,
          messageId: pollMsg.message_id,
        },
        timeLimit + 2
      );

      // In-memory immediate timer
      const timerKey = `timer_${sessionId}_${questionIndex}`;
      const timer = setTimeout(async () => {
        this.activeTimers.delete(timerKey);
        await this.handleQuestionTimeout({
          sessionId,
          questionIndex,
          telegramPollId: pollMsg.poll.id,
          chatId,
          messageId: pollMsg.message_id,
        });
      }, (timeLimit + 2) * 1000);

      this.activeTimers.set(timerKey, timer);
    } else {
      // Untimed Quiz: provide teacher with explicit progression button
      const nextBtn = new InlineKeyboard().text(
        '➡️ Keyingi savolga o‘tish',
        `next_question_${sessionId}_${questionIndex + 1}`
      );
      await this.bot.api.sendMessage(chatId, '⏱ Ushbu savol vaqti cheklanmagan. Tayyor bo‘lgach keyingisiga o‘ting:', {
        reply_markup: nextBtn,
      });
    }
  }

  /**
   * Safe, idempotent question timeout handler.
   */
  private async handleQuestionTimeout(data: PollTimerJobData) {
    const poll = await this.prisma.pollInstance.findUnique({
      where: { telegramPollId: data.telegramPollId },
      include: { session: true },
    });

    if (!poll || !poll.isOpen) return; // Already closed/advanced

    // Mark closed in database
    await this.prisma.pollInstance.update({
      where: { id: poll.id },
      data: { isOpen: false, closedAt: new Date() },
    });

    if (this.bot && data.messageId) {
      try {
        await this.bot.api.stopPoll(data.chatId, data.messageId);
      } catch {}
    }

    // Advance to next question
    await this.dispatchQuestion(data.sessionId, data.questionIndex + 1);
  }

  /**
   * Idempotent poll answer handler.
   * Completely eliminates duplicate score increments and handles answer changes correctly!
   */
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

    const existingAnswer = await this.prisma.pollAnswer.findUnique({
      where: {
        pollInstanceId_userId: { pollInstanceId: pollInstance.id, userId: user.id },
      },
    });

    if (existingAnswer) {
      // Prevent duplicate update delivery from inflating score or totalAnswered
      const oldScore = existingAnswer.isCorrect ? 1 : 0;
      const newScore = isCorrect ? 1 : 0;
      const deltaScore = newScore - oldScore;

      await this.prisma.pollAnswer.update({
        where: { id: existingAnswer.id },
        data: {
          selectedOptions: selectedOptionIds,
          isCorrect,
          responseTimeMs,
        },
      });

      if (deltaScore !== 0) {
        await this.prisma.sessionParticipant.update({
          where: {
            sessionId_userId: { sessionId: pollInstance.sessionId, userId: user.id },
          },
          data: {
            score: { increment: deltaScore },
            totalCorrect: { increment: deltaScore },
          },
        });
      }
    } else {
      // First time answering this poll
      await this.prisma.pollAnswer.create({
        data: {
          pollInstanceId: pollInstance.id,
          userId: user.id,
          telegramPollId: pollId,
          selectedOptions: selectedOptionIds,
          isCorrect,
          responseTimeMs,
        },
      });

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

    // Check if all registered participants have answered
    const totalParticipants = await this.prisma.sessionParticipant.count({
      where: { sessionId: pollInstance.sessionId },
    });
    const totalAnswers = await this.prisma.pollAnswer.count({
      where: { pollInstanceId: pollInstance.id },
    });

    if (totalParticipants > 0 && totalAnswers >= totalParticipants && pollInstance.isOpen) {
      // Everyone answered -> Advance to next question immediately
      this.logger.log(`🎯 Barcha ishtirokchilar javob berdi (${totalAnswers}/${totalParticipants}). Keyingi savolga o‘tilmoqda...`);
      await this.handleQuestionTimeout({
        sessionId: pollInstance.sessionId,
        questionIndex: pollInstance.session.currentQuestionIndex,
        telegramPollId: pollInstance.telegramPollId,
        chatId: Number(pollInstance.chatId || 0),
        messageId: pollInstance.messageId || undefined,
      });
    }
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

    const { isHttps, url: webResultsUrl } = this.getWebDashboardUrl(`/dashboard/sessions/${session.id}`);
    const keyboard = new InlineKeyboard().text('📥 Excel Hisobot', `excel_report_${session.id}`);
    if (isHttps) {
      keyboard.webApp('🌐 Veb Natijalar', webResultsUrl);
    } else if (webResultsUrl && !webResultsUrl.includes('localhost')) {
      keyboard.url('🌐 Veb Natijalar', webResultsUrl);
    }

    await this.bot.api.sendMessage(Number(session.telegramChatId), leaderboardMsg, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  }

  /**
   * Excel export with STRICT AUTHORIZATION check:
   * Only the session creator or Super Admin can receive the full group report!
   */
  private async handleSendExcelReport(ctx: any, user: any, sessionId: string) {
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

    // PRIVACY CHECK: Verify user is session creator or Super Admin
    if (session.createdById !== user.id && user.role !== UserRole.SUPER_ADMIN) {
      await ctx.answerCallbackQuery({
        text: '❌ Ushbu hisobotni faqat test muallifi yuklab olishi mumkin!',
        show_alert: true,
      });
      return;
    }

    await ctx.answerCallbackQuery({ text: 'Hisobot tayyorlanmoqda... ⏳' });

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
