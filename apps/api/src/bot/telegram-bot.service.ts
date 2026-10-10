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

export interface RequiredChannel {
  chatId: string;
  url: string;
  name: string;
}

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: Bot | null = null;
  private config: AppConfig;
  private userStates = new Map<string, { step: string; data?: any }>();
  private userSettings = new Map<
    string,
    { timeLimitSeconds: number; shuffleQuestions: boolean; shuffleOptions: boolean; showExplanation: boolean }
  >();
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
    const checkSub = async (ctx: any): Promise<boolean> => {
      if (ctx.chat.type !== 'private') return true;
      const sub = await this.checkUserSubscription(ctx.from.id);
      if (!sub.isSubscribed) {
        const { text: subText, reply_markup } = this.buildSubscriptionMessage(
          sub.unsubscribedChannels,
          'check_sub_start'
        );
        await ctx.reply(subText, { parse_mode: 'HTML', reply_markup });
        return false;
      }
      return true;
    };

    this.bot.command('start', async (ctx) => {
      const from = ctx.from;
      if (!from) return;

      const user = await this.upsertTelegramUser(from);
      const text = ctx.match;

      if (text && (text.startsWith('quiz_') || text.startsWith('startquiz_'))) {
        const quizId = text.replace('quiz_', '').replace('startquiz_', '');
        if (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup') {
          await this.handleStartQuizInGroup(ctx, quizId);
        } else {
          // Individual quiz start: verify subscription first
          const sub = await this.checkUserSubscription(from.id);
          if (!sub.isSubscribed) {
            const { text: subText, reply_markup } = this.buildSubscriptionMessage(
              sub.unsubscribedChannels,
              `check_sub_indiv_${quizId}`
            );
            await ctx.reply(subText, { parse_mode: 'HTML', reply_markup });
            return;
          }
          await this.handleIndividualQuizStart(ctx, user, quizId);
        }
        return;
      }

      // Private chat regular start: verify subscription
      if (ctx.chat.type === 'private') {
        const sub = await this.checkUserSubscription(from.id);
        if (!sub.isSubscribed) {
          const { text: subText, reply_markup } = this.buildSubscriptionMessage(
            sub.unsubscribedChannels,
            'check_sub_start'
          );
          await ctx.reply(subText, { parse_mode: 'HTML', reply_markup });
          return;
        }
      }

      await ctx.reply(UZ_MESSAGES.WELCOME(from.first_name), {
        parse_mode: 'HTML',
        reply_markup: this.getMainKeyboard(),
      });
    });

    // 2. /startquiz command for group testing
    this.bot.command('startquiz', async (ctx) => {
      const match = ctx.match?.trim();
      if (!match) {
        await ctx.reply(
          '⚠️ <b>Guruhda test boshlash:</b>\n\n' +
          'Test ID raqamini ko‘rsating:\n' +
          '<code>/startquiz &lt;test_id&gt;</code>\n\n' +
          '<i>Yoki «📚 Testlarim» bo‘limiga kirib test ostidagi «🚀 Guruhda» tugmasini bosing.</i>',
          { parse_mode: 'HTML' }
        );
        return;
      }
      await this.handleStartQuizInGroup(ctx, match);
    });

    // 3. /help command
    this.bot.command('help', async (ctx) => {
      await this.showUserHelp(ctx);
    });

    // 4. /cancel command
    this.bot.command('cancel', async (ctx) => {
      if (ctx.from) {
        this.userStates.delete(ctx.from.id.toString());
      }
      await ctx.reply('❌ Amal bekor qilindi. Bosh menyudasiz.');
    });

    // 5. Menu Buttons
    this.bot.hears(UZ_MENUS.CREATE_QUIZ, async (ctx) => {
      if (!ctx.from) return;
      if (!(await checkSub(ctx))) return;
      this.userStates.set(ctx.from.id.toString(), {
        step: 'awaiting_quiz_title',
        data: { questions: [] },
      });
      await ctx.reply(
        '📝 <b>Yangi test yaratish</b>\n\n' +
        'Test mavzusini (nomini) kiriting:\n' +
        '<i>Masalan: 8-sinf Kimyo — Davriy qonun</i>\n\n' +
        '❌ <i>Bekor qilish uchun: /cancel</i>',
        { parse_mode: 'HTML' }
      );
    });

    this.bot.hears(UZ_MENUS.MY_QUIZZES, async (ctx) => {
      if (!ctx.from) return;
      if (!(await checkSub(ctx))) return;
      await this.showUserQuizzes(ctx);
    });

    this.bot.hears(UZ_MENUS.RESULTS, async (ctx) => {
      if (!ctx.from) return;
      if (!(await checkSub(ctx))) return;
      await this.showUserResults(ctx);
    });

    this.bot.hears(UZ_MENUS.MY_GROUPS, async (ctx) => {
      if (!ctx.from) return;
      if (!(await checkSub(ctx))) return;
      await this.showUserGroups(ctx);
    });

    this.bot.hears(UZ_MENUS.STATISTICS, async (ctx) => {
      if (!ctx.from) return;
      if (!(await checkSub(ctx))) return;
      await this.showUserStats(ctx);
    });

    this.bot.hears(UZ_MENUS.PROFILE, async (ctx) => {
      if (!ctx.from) return;
      if (!(await checkSub(ctx))) return;
      await this.showUserProfile(ctx);
    });

    this.bot.hears(UZ_MENUS.SETTINGS, async (ctx) => {
      if (!ctx.from) return;
      if (!(await checkSub(ctx))) return;
      await this.showUserSettings(ctx);
    });

    this.bot.hears(UZ_MENUS.HELP, async (ctx) => {
      if (!ctx.from) return;
      await this.showUserHelp(ctx);
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
          .text('🚀 Guruhda', `start_group_${quiz.id}`)
          .text('▶️ O‘zim yechish', `start_indiv_${quiz.id}`)
          .row()
          .text('📋 Savollar', `view_quiz_${quiz.id}`)
          .row()
          .text('🗑 O‘chirish', `confirm_delete_quiz_${quiz.id}`);

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

    // 6. Text message router for manual question-by-question creation
    this.bot.on('message:text', async (ctx) => {
      const from = ctx.from;
      if (!from) return;
      const state = this.userStates.get(from.id.toString());
      if (!state) return;

      if (state.step === 'awaiting_quiz_title') {
        const title = ctx.message.text.trim();
        if (title.length < 2) {
          await ctx.reply('❌ Test nomi juda qisqa. Qayta kiriting:');
          return;
        }
        state.data = state.data || { questions: [] };
        state.data.title = title;
        state.step = 'awaiting_question_text';
        await ctx.reply(
          `✅ Test nomi: <b>${title}</b>\n\n` +
          `Endi <b>1-savol matnini</b> kiriting:\n` +
          `<i>Masalan: Suvning kimyoviy formulasi qaysi?</i>\n\n` +
          `❌ <i>Bekor qilish uchun: /cancel</i>`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      if (state.step === 'awaiting_question_text') {
        const qText = ctx.message.text.trim();
        if (qText.length < 2) {
          await ctx.reply('❌ Savol matni juda qisqa. Qayta kiriting:');
          return;
        }
        state.data.currentQuestionText = qText;
        state.step = 'awaiting_question_options';
        const qNum = (state.data.questions?.length || 0) + 1;
        await ctx.reply(
          `❓ <b>${qNum}-savol:</b> ${qText}\n\n` +
          `Endi ushbu savolning variantlarini yuboring (har bir variantni <b>yangi qatordan</b> yozing):\n\n` +
          `<i>Namuna:\nA) H2O\nB) CO2\nC) O2\nD) NaCl</i>\n\n` +
          `<i>(Kamida 2 ta variant)</i>`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      if (state.step === 'awaiting_question_options') {
        const text = ctx.message.text.trim();
        const rawLines = text.split('\n').map((l) => l.trim()).filter(Boolean);
        const cleaned = rawLines.map((l) => l.replace(/^[A-Za-z0-9][\)\.\-]\s*/, '').trim()).filter(Boolean);

        if (cleaned.length < 2) {
          await ctx.reply(
            '❌ Kamida <b>2 ta variant</b> kiritishingiz kerak!\n\n' +
            'Har bir variantni yangi qatordan yozib qayta yuboring:\n' +
            '<i>A) Variant 1\nB) Variant 2\nC) Variant 3</i>',
            { parse_mode: 'HTML' }
          );
          return;
        }

        if (cleaned.length > 10) {
          await ctx.reply('❌ Variantlar soni ko‘pi bilan 10 ta bo‘lishi mumkin. Qayta yuboring:');
          return;
        }

        state.data.currentOptions = cleaned;
        state.step = 'awaiting_correct_option';

        const kb = new InlineKeyboard();
        cleaned.forEach((opt, idx) => {
          const letter = String.fromCharCode(65 + idx);
          kb.text(`${letter}) ${opt.slice(0, 30)}`, `set_correct_${idx}`).row();
        });

        await ctx.reply(
          `❓ Savol: <b>${state.data.currentQuestionText}</b>\n\n` +
          `Quyidagi variantlardan <b>to‘g‘ri javobni</b> tanlang:`,
          { parse_mode: 'HTML', reply_markup: kb }
        );
        return;
      }
    });

    // 7. Callback query handlers
    this.bot.on('callback_query:data', async (ctx) => {
      const data = ctx.callbackQuery.data;
      const user = await this.upsertTelegramUser(ctx.from);

      // --- Manual Question Flow Callbacks ---
      if (data.startsWith('set_correct_')) {
        const optIdx = parseInt(data.replace('set_correct_', ''), 10);
        const fromId = ctx.from.id.toString();
        const state = this.userStates.get(fromId);

        if (!state || !state.data?.currentQuestionText || !state.data?.currentOptions) {
          await ctx.answerCallbackQuery({ text: 'Eski yoki bekor qilingan amal.' });
          return;
        }

        const qText = state.data.currentQuestionText;
        const options = state.data.currentOptions.map((optText: string, idx: number) => ({
          text: optText,
          isCorrect: idx === optIdx,
        }));

        state.data.questions = state.data.questions || [];
        state.data.questions.push({ text: qText, options });
        delete state.data.currentQuestionText;
        delete state.data.currentOptions;
        state.step = 'awaiting_next_action';

        await ctx.answerCallbackQuery({ text: 'To‘g‘ri javob tanlandi! ✅' });

        const count = state.data.questions.length;
        const correctLetter = String.fromCharCode(65 + optIdx);
        const correctText = options[optIdx].text;

        const actionKb = new InlineKeyboard()
          .text('➕ Keyingi savolni qo‘shish', 'manual_add_next')
          .row()
          .text('🏁 Testni yakunlash va saqlash', 'manual_finish_quiz')
          .row()
          .text('❌ Bekor qilish', 'manual_cancel_quiz');

        await ctx.reply(
          `✅ <b>${count}-savol saqlandi!</b>\n\n` +
          `📝 <b>Savol:</b> ${qText}\n` +
          `🎯 <b>To‘g‘ri javob:</b> ${correctLetter}) ${correctText}\n\n` +
          `Jami kiritilgan savollar: <b>${count} ta</b>\n\n` +
          `Yana savol qo‘shasizmi yoki testni saqlaysizmi?`,
          { parse_mode: 'HTML', reply_markup: actionKb }
        );
        return;
      }

      if (data === 'manual_add_next') {
        const fromId = ctx.from.id.toString();
        const state = this.userStates.get(fromId);
        if (!state) {
          await ctx.answerCallbackQuery({ text: 'Amal topilmadi.' });
          return;
        }
        await ctx.answerCallbackQuery();
        state.step = 'awaiting_question_text';
        const nextNum = (state.data?.questions?.length || 0) + 1;
        await ctx.reply(
          `📝 <b>${nextNum}-savol matnini</b> kiriting:\n\n` +
          `❌ <i>Bekor qilish uchun: /cancel</i>`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      if (data === 'manual_finish_quiz') {
        const fromId = ctx.from.id.toString();
        const state = this.userStates.get(fromId);
        if (!state || !state.data?.questions || state.data.questions.length === 0) {
          await ctx.answerCallbackQuery({ text: 'Kamida 1 ta savol kiritishingiz shart!', show_alert: true });
          return;
        }

        await ctx.answerCallbackQuery({ text: 'Test saqlanmoqda... ⏳' });

        const quizTitle = state.data.title || 'Yangi test';
        const questions = state.data.questions;
        const settings = this.getUserSettings(fromId);

        const quiz = await this.prisma.quiz.create({
          data: {
            title: quizTitle,
            creatorId: user.id,
            status: QuizStatus.PUBLISHED,
            currentVersion: 1,
            settings: {
              timeLimitPerQuestionSeconds: settings.timeLimitSeconds,
              shuffleQuestions: settings.shuffleQuestions,
              shuffleOptions: settings.shuffleOptions,
              showExplanation: settings.showExplanation,
            },
            versions: {
              create: {
                versionNumber: 1,
                title: quizTitle,
                questions: {
                  create: questions.map((q: any, idx: number) => ({
                    questionIndex: idx + 1,
                    text: q.text,
                    points: 1,
                    options: {
                      create: q.options.map((opt: any, optIdx: number) => ({
                        optionIndex: optIdx,
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

        this.userStates.delete(fromId);

        const kb = new InlineKeyboard()
          .text('🚀 Guruhda boshlash', `start_group_${quiz.id}`)
          .row()
          .text('📋 Savollarni ko‘rish', `view_quiz_${quiz.id}`)
          .row()
          .text('📚 Barcha testlarim', 'menu_my_quizzes');

        await ctx.reply(
          `🎉 <b>«${quizTitle}» testi muvaffaqiyatli saqlandi!</b>\n\n` +
          `📝 <b>Jami savollar:</b> ${questions.length} ta\n` +
          `⏱ <b>Savol vaqti:</b> ${settings.timeLimitSeconds > 0 ? settings.timeLimitSeconds + ' soniya' : 'Cheklovsiz'}\n\n` +
          `Endi ushbu testni guruhingizda o‘tkazishingiz mumkin:`,
          { parse_mode: 'HTML', reply_markup: kb }
        );
        return;
      }

      if (data === 'manual_cancel_quiz') {
        this.userStates.delete(ctx.from.id.toString());
        await ctx.answerCallbackQuery({ text: 'Bekor qilindi' });
        await ctx.reply('❌ Test yaratish bekor qilindi. Bosh menyudasiz.');
        return;
      }

      // --- Quiz Actions ---
      if (data.startsWith('view_quiz_')) {
        const quizId = data.replace('view_quiz_', '');
        await ctx.answerCallbackQuery();
        await this.showQuizQuestions(ctx, quizId);
        return;
      }

      if (data.startsWith('confirm_delete_quiz_')) {
        const quizId = data.replace('confirm_delete_quiz_', '');
        await ctx.answerCallbackQuery();
        const kb = new InlineKeyboard()
          .text('🗑 Ha, o‘chirish', `do_delete_quiz_${quizId}`)
          .text('❌ Bekor qilish', 'cancel_delete_quiz');
        await ctx.reply('⚠️ <b>Ushbu testni butunlay o‘chirib tashlamoqchimisiz?</b>', {
          parse_mode: 'HTML',
          reply_markup: kb,
        });
        return;
      }

      if (data.startsWith('do_delete_quiz_')) {
        const quizId = data.replace('do_delete_quiz_', '');
        await this.prisma.quiz.deleteMany({
          where: { id: quizId, creatorId: user.id },
        });
        await ctx.answerCallbackQuery({ text: 'Test o‘chirildi ✅' });
        await ctx.reply('✅ Test muvaffaqiyatli o‘chirildi.');
        return;
      }

      if (data === 'cancel_delete_quiz') {
        await ctx.answerCallbackQuery({ text: 'Bekor qilindi' });
        await ctx.reply('O‘chirish bekor qilindi.');
        return;
      }

      if (data === 'menu_my_quizzes') {
        await ctx.answerCallbackQuery();
        await this.showUserQuizzes(ctx);
        return;
      }

      // --- Settings Toggles ---
      if (data === 'toggle_setting_time') {
        const fromId = ctx.from.id.toString();
        const s = this.getUserSettings(fromId);
        const times = [15, 30, 45, 60, 0];
        const curIdx = times.indexOf(s.timeLimitSeconds);
        s.timeLimitSeconds = times[(curIdx + 1) % times.length];
        await ctx.answerCallbackQuery({ text: `Vaqt: ${s.timeLimitSeconds === 0 ? 'Vaqtsiz' : s.timeLimitSeconds + 's'}` });
        await this.showUserSettings(ctx);
        return;
      }

      if (data === 'toggle_setting_shuffle_q') {
        const fromId = ctx.from.id.toString();
        const s = this.getUserSettings(fromId);
        s.shuffleQuestions = !s.shuffleQuestions;
        await ctx.answerCallbackQuery({ text: s.shuffleQuestions ? 'Aralashtirish yoqildi' : 'O‘chirildi' });
        await this.showUserSettings(ctx);
        return;
      }

      if (data === 'toggle_setting_shuffle_o') {
        const fromId = ctx.from.id.toString();
        const s = this.getUserSettings(fromId);
        s.shuffleOptions = !s.shuffleOptions;
        await ctx.answerCallbackQuery({ text: s.shuffleOptions ? 'Variantlar aralashtiriladi' : 'O‘chirildi' });
        await this.showUserSettings(ctx);
        return;
      }

      if (data === 'toggle_setting_expl') {
        const fromId = ctx.from.id.toString();
        const s = this.getUserSettings(fromId);
        s.showExplanation = !s.showExplanation;
        await ctx.answerCallbackQuery({ text: s.showExplanation ? 'Izohlar ko‘rsatiladi' : 'O‘chirildi' });
        await this.showUserSettings(ctx);
        return;
      }

      // --- Subscription Check Callbacks ---
      if (data === 'check_sub_start') {
        const sub = await this.checkUserSubscription(ctx.from.id);
        if (!sub.isSubscribed) {
          await ctx.answerCallbackQuery({
            text: '❌ Siz hali barcha kanallarga a’zo bo‘lmadingiz! Iltimos, obuna bo‘lib qayta tekshiring.',
            show_alert: true,
          });
          return;
        }

        await ctx.answerCallbackQuery({ text: '✅ Obuna tasdiqlandi!' });
        try {
          await ctx.deleteMessage();
        } catch {}
        await ctx.reply(
          `🎉 <b>Obunangiz muvaffaqiyatli tasdiqlandi!</b>\n\n` +
          UZ_MESSAGES.WELCOME(ctx.from.first_name),
          {
            parse_mode: 'HTML',
            reply_markup: this.getMainKeyboard(),
          }
        );
        return;
      }

      if (data.startsWith('check_sub_indiv_')) {
        const quizId = data.replace('check_sub_indiv_', '');
        const sub = await this.checkUserSubscription(ctx.from.id);
        if (!sub.isSubscribed) {
          await ctx.answerCallbackQuery({
            text: '❌ Siz hali barcha kanallarga a’zo bo‘lmadingiz! Iltimos, obuna bo‘lib qayta tekshiring.',
            show_alert: true,
          });
          return;
        }

        await ctx.answerCallbackQuery({ text: '✅ Obuna tasdiqlandi!' });
        try {
          await ctx.deleteMessage();
        } catch {}
        await this.handleIndividualQuizStart(ctx, user, quizId);
        return;
      }

      if (data.startsWith('check_sub_join_')) {
        const sessionId = data.replace('check_sub_join_', '');
        const sub = await this.checkUserSubscription(ctx.from.id);
        if (!sub.isSubscribed) {
          await ctx.answerCallbackQuery({
            text: '❌ Siz hali barcha kanallarga a’zo bo‘lmadingiz! Iltimos, obuna bo‘lib qayta tekshiring.',
            show_alert: true,
          });
          return;
        }

        await ctx.answerCallbackQuery({ text: '✅ Obuna tasdiqlandi!' });
        try {
          await ctx.deleteMessage();
        } catch {}
        const res = await this.registerParticipantInSession(ctx, sessionId, user);
        if (res.success) {
          await ctx.reply(
            '🎉 <b>Siz testga muvaffaqiyatli ro‘yxatdan o‘tdingiz!</b>\n\n' +
            'Endi guruhga qaytib test boshlanishini kuting.',
            { parse_mode: 'HTML' }
          );
        } else {
          await ctx.reply(`⚠️ ${res.reason}`);
        }
        return;
      }

      if (data.startsWith('start_indiv_')) {
        const quizId = data.replace('start_indiv_', '');
        const sub = await this.checkUserSubscription(ctx.from.id);
        if (!sub.isSubscribed) {
          const { text: subText, reply_markup } = this.buildSubscriptionMessage(
            sub.unsubscribedChannels,
            `check_sub_indiv_${quizId}`
          );
          await ctx.reply(subText, { parse_mode: 'HTML', reply_markup });
          await ctx.answerCallbackQuery();
          return;
        }
        await ctx.answerCallbackQuery();
        await this.handleIndividualQuizStart(ctx, user, quizId);
        return;
      }

      // --- Session Running Callbacks ---
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

  public getMainKeyboard(): Keyboard {
    return new Keyboard()
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
  }

  public parseRequiredChannels(): RequiredChannel[] {
    return (this.config.requiredChannels || [])
      .map((raw, idx) => {
        const item = raw.trim();
        if (!item) return null;

        // Format: ID:URL or ID|URL
        if (item.includes(':') && (item.startsWith('-') || /^\d+/.test(item))) {
          const [idPart, urlPart] = item.split(':');
          return {
            chatId: idPart.trim(),
            url: urlPart.startsWith('http') ? urlPart.trim() : `https://${urlPart.trim()}`,
            name: `Kanal ${idx + 1}`,
          };
        }
        if (item.includes('|')) {
          const [idPart, urlPart] = item.split('|');
          return {
            chatId: idPart.trim(),
            url: urlPart.startsWith('http') ? urlPart.trim() : `https://${urlPart.trim()}`,
            name: `Kanal ${idx + 1}`,
          };
        }

        // URL format: https://t.me/channel_name or t.me/channel_name
        const linkMatch = item.match(/(?:https?:\/\/)?t\.me\/([a-zA-Z0-9_]+)/);
        if (linkMatch && !item.includes('/+') && !item.includes('joinchat')) {
          const username = linkMatch[1];
          return {
            chatId: `@${username}`,
            url: `https://t.me/${username}`,
            name: `@${username}`,
          };
        }

        // Username format: @channel_name
        if (item.startsWith('@')) {
          const username = item.replace('@', '');
          return {
            chatId: `@${username}`,
            url: `https://t.me/${username}`,
            name: `@${username}`,
          };
        }

        // Numeric chat ID
        if (/^-?\d+$/.test(item)) {
          return {
            chatId: item,
            url: `https://t.me/`,
            name: `Kanal ${idx + 1}`,
          };
        }

        // Default username without @
        return {
          chatId: `@${item}`,
          url: `https://t.me/${item}`,
          name: `@${item}`,
        };
      })
      .filter((c): c is RequiredChannel => c !== null);
  }

  public async checkUserSubscription(userId: number | bigint): Promise<{
    isSubscribed: boolean;
    unsubscribedChannels: RequiredChannel[];
  }> {
    if (!this.bot) return { isSubscribed: true, unsubscribedChannels: [] };

    // Super Admin bypass
    if (this.config.superAdminTelegramIds.includes(userId.toString())) {
      return { isSubscribed: true, unsubscribedChannels: [] };
    }

    const channels = this.parseRequiredChannels();
    if (channels.length === 0) {
      return { isSubscribed: true, unsubscribedChannels: [] };
    }

    const unsubscribed: RequiredChannel[] = [];

    for (const channel of channels) {
      try {
        const member = await this.bot.api.getChatMember(channel.chatId, Number(userId));
        const activeStatuses = ['creator', 'administrator', 'member'];
        const isMember =
          activeStatuses.includes(member.status) ||
          (member.status === 'restricted' && (member as any).is_member === true);

        if (!isMember) {
          unsubscribed.push(channel);
        }
      } catch (err: any) {
        const errMsg = err?.message || '';
        this.logger.warn(`Kanal (${channel.chatId}) a'zoligini tekshirishda xatolik: ${errMsg}`);

        if (errMsg.includes('user not found') || errMsg.includes('PARTICIPANT_ID_INVALID')) {
          unsubscribed.push(channel);
        } else if (
          errMsg.includes('chat not found') ||
          errMsg.includes('bot is not a member') ||
          errMsg.includes('not enough rights')
        ) {
          this.logger.error(
            `⚠️ DIQQAT: Bot "${channel.chatId}" kanaliga a'zo yoki admin qilinmagan! Iltimos, botni kanalga admin qilib qo'shing.`
          );
        } else {
          unsubscribed.push(channel);
        }
      }
    }

    return {
      isSubscribed: unsubscribed.length === 0,
      unsubscribedChannels: unsubscribed,
    };
  }

  public buildSubscriptionMessage(
    unsubscribed: RequiredChannel[],
    checkCallbackData: string
  ): { text: string; reply_markup: InlineKeyboard } {
    let text =
      `⚠️ <b>Kanalga a’zo bo‘lish talab etiladi!</b>\n\n` +
      `Botdan to‘liq foydalanish va testlarni yechish uchun quyidagi homiy / rasmiy kanal(lar)imizga obuna bo‘ling:\n\n`;

    const kb = new InlineKeyboard();
    unsubscribed.forEach((ch, idx) => {
      text += `${idx + 1}. <b>${ch.name}</b>\n`;
      kb.url(`📢 A’zo bo‘lish (${ch.name})`, ch.url).row();
    });

    text += `\nObuna bo‘lgach, pastdagi <b>«✅ Obunani tekshirish»</b> tugmasini bosing:`;
    kb.text(`✅ Obunani tekshirish`, checkCallbackData);

    return { text, reply_markup: kb };
  }

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
      take: 15,
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
        `📚 <b>Sizda hali testlar mavjud emas.</b>\n\n` +
        `«➕ Test yaratish» tugmasini bosib birinchi testingizni yarating!`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    let text = `📚 <b>Siz yaratgan testlar:</b>\n\n`;
    const keyboard = new InlineKeyboard();

    quizzes.forEach((q, idx) => {
      const qCount = q.versions[0]?._count?.questions || 0;
      text += `${idx + 1}. <b>${q.title}</b> (${qCount} ta savol)\n`;
      keyboard
        .text(`🚀 Guruhda`, `start_group_${q.id}`)
        .text(`▶️ O‘zim yechish`, `start_indiv_${q.id}`)
        .row()
        .text(`📋 Savollar (${qCount})`, `view_quiz_${q.id}`)
        .text(`🗑`, `confirm_delete_quiz_${q.id}`)
        .row();
    });

    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
  }

  private async showQuizQuestions(ctx: any, quizId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        versions: {
          take: 1,
          orderBy: { versionNumber: 'desc' },
          include: {
            questions: {
              orderBy: { questionIndex: 'asc' },
              include: { options: { orderBy: { optionIndex: 'asc' } } },
            },
          },
        },
      },
    });

    if (!quiz || quiz.versions.length === 0) {
      await ctx.reply('❌ Test topilmadi.');
      return;
    }

    const version = quiz.versions[0];
    let msg = `📋 <b>«${quiz.title}» testi savollari:</b>\n\n`;

    if (version.questions.length === 0) {
      msg += `<i>Ushbu testda hali savollar mavjud emas.</i>`;
    } else {
      version.questions.forEach((q) => {
        msg += `<b>${q.questionIndex}. ${q.text}</b>\n`;
        q.options.forEach((opt) => {
          const letter = String.fromCharCode(65 + opt.optionIndex);
          const icon = opt.isCorrect ? '✅' : '⚪️';
          msg += `   ${icon} ${letter}) ${opt.text}\n`;
        });
        msg += '\n';
      });
    }

    const kb = new InlineKeyboard()
      .text('🚀 Guruhda boshlash', `start_group_${quiz.id}`)
      .row()
      .text('🗑 Testni o‘chirish', `confirm_delete_quiz_${quiz.id}`);

    await ctx.reply(msg, { parse_mode: 'HTML', reply_markup: kb });
  }

  private async showUserResults(ctx: any) {
    const user = await this.upsertTelegramUser(ctx.from!);
    const sessions = await this.prisma.quizSession.findMany({
      where: { createdById: user.id },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: {
        group: true,
        quizVersion: true,
        _count: { select: { participants: true } },
      },
    });

    if (sessions.length === 0) {
      await ctx.reply(
        '🏆 <b>Sizda hali o‘tkazilgan test sessiyalari yo‘q.</b>\n\n' +
        'Guruhlaringizda test boshlang, barcha natijalar va Excel hisobotlar shu yerda chiqadi!',
        { parse_mode: 'HTML' }
      );
      return;
    }

    let text = `🏆 <b>Oxirgi o‘tkazilgan test natijalari:</b>\n\n`;
    const keyboard = new InlineKeyboard();

    sessions.forEach((s, idx) => {
      const gTitle = s.group?.title || 'Guruh';
      const dateStr = s.startedAt ? s.startedAt.toLocaleDateString('uz-UZ') : '';
      text += `${idx + 1}. <b>${s.quizVersion.title}</b> (${gTitle})\n`;
      text += `   👥 Qatnashchilar: ${s._count.participants} nafar | Sana: ${dateStr}\n\n`;
      keyboard.text(`📥 Excel Hisobot (#${idx + 1})`, `excel_report_${s.id}`).row();
    });

    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
  }

  private async showUserGroups(ctx: any) {
    const user = await this.upsertTelegramUser(ctx.from!);
    const sessions = await this.prisma.quizSession.findMany({
      where: { createdById: user.id, telegramChatId: { not: null } },
      select: {
        telegramChatId: true,
        group: true,
        quizVersion: { select: { title: true } },
      },
      distinct: ['telegramChatId'],
      take: 10,
    });

    let text = `👥 <b>GURUHLAR BO‘LIMI</b>\n\n`;

    if (sessions.length > 0) {
      text += `<b>Siz test o‘tkazgan guruhlar:</b>\n`;
      sessions.forEach((s, idx) => {
        const title = s.group?.title || `Guruh (ID: ${s.telegramChatId})`;
        text += `${idx + 1}. <b>${title}</b>\n`;
      });
      text += `\n`;
    }

    text +=
      `<b>📌 Guruhda yangi test o‘tkazish:</b>\n\n` +
      `1. Botni guruhingizga qo‘shing.\n` +
      `2. Botga guruhda <b>Admin (Administrator)</b> huquqini bering (so‘rovnoma jo‘natishi uchun).\n` +
      `3. «📚 Testlarim» bo‘limiga kiring va test ostidagi <b>«🚀 Boshlash»</b> tugmasini bosing.\n` +
      `4. Guruhingizda <b>«✅ Tayyorman»</b> tugmali so‘rovnoma boshlanadi!`;

    await ctx.reply(text, { parse_mode: 'HTML' });
  }

  private async showUserStats(ctx: any) {
    const user = await this.upsertTelegramUser(ctx.from!);

    const quizzesCount = await this.prisma.quiz.count({ where: { creatorId: user.id } });

    const userQuizzes = await this.prisma.quiz.findMany({
      where: { creatorId: user.id },
      include: {
        versions: {
          include: { _count: { select: { questions: true } } },
        },
      },
    });
    const totalQuestions = userQuizzes.reduce(
      (sum, q) => sum + (q.versions[0]?._count?.questions || 0),
      0
    );

    const totalSessions = await this.prisma.quizSession.count({ where: { createdById: user.id } });

    const totalParticipants = await this.prisma.sessionParticipant.count({
      where: { session: { createdById: user.id } },
    });

    const totalAnswers = await this.prisma.pollAnswer.count({
      where: { pollInstance: { session: { createdById: user.id } } },
    });
    const correctAnswers = await this.prisma.pollAnswer.count({
      where: { pollInstance: { session: { createdById: user.id } }, isCorrect: true },
    });
    const accuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;

    let text = `📊 <b>SMART QUIZ BOT — FOYDALANUVCHI STATISTIKASI</b>\n\n`;
    text += `👤 <b>Foydalanuvchi:</b> ${ctx.from.first_name}\n\n`;
    text += `📚 <b>Yaratilgan testlar:</b> ${quizzesCount} ta\n`;
    text += `📝 <b>Jami savollar:</b> ${totalQuestions} ta\n`;
    text += `🚀 <b>O‘tkazilgan guruh sessiyalari:</b> ${totalSessions} ta\n`;
    text += `👥 <b>Testlarda qatnashgan o‘quvchilar:</b> ${totalParticipants} nafar\n`;
    text += `🎯 <b>Berilgan jami javoblar:</b> ${totalAnswers} ta\n`;
    text += `✅ <b>To‘g‘ri javoblar:</b> ${correctAnswers} ta (${accuracy}%)\n\n`;
    text += `<i>💡 Guruhlaringizda ko‘proq test o‘tkazib o‘quvchilar bilimini mustahkamlang!</i>`;

    await ctx.reply(text, { parse_mode: 'HTML' });
  }

  private async showUserProfile(ctx: any) {
    const user = await this.upsertTelegramUser(ctx.from!);
    const quizzesCount = await this.prisma.quiz.count({ where: { creatorId: user.id } });
    const sessionsCount = await this.prisma.quizSession.count({ where: { createdById: user.id } });

    let text = `👤 <b>SIZNING PROFILINGIZ:</b>\n\n`;
    text += `🆔 <b>Telegram ID:</b> <code>${user.telegramId}</code>\n`;
    text += `👤 <b>Ism:</b> ${user.firstName} ${user.lastName || ''}\n`;
    if (user.username) text += `🔹 <b>Username:</b> @${user.username}\n`;
    text += `🎖 <b>Daraja:</b> ${user.role === UserRole.SUPER_ADMIN ? 'Super Admin 👑' : 'O‘qituvchi 👨‍🏫'}\n`;
    text += `📅 <b>A’zolik sanasi:</b> ${user.createdAt.toLocaleDateString('uz-UZ')}\n\n`;
    text += `📚 <b>Yaratgan testlaringiz:</b> ${quizzesCount} ta\n`;
    text += `🏆 <b>O‘tkazgan sessiyalaringiz:</b> ${sessionsCount} ta\n`;

    await ctx.reply(text, { parse_mode: 'HTML' });
  }

  private getUserSettings(userId: string) {
    let s = this.userSettings.get(userId);
    if (!s) {
      s = {
        timeLimitSeconds: 30,
        shuffleQuestions: true,
        shuffleOptions: true,
        showExplanation: true,
      };
      this.userSettings.set(userId, s);
    }
    return s;
  }

  private async showUserSettings(ctx: any) {
    const fromId = ctx.from.id.toString();
    const s = this.getUserSettings(fromId);

    const timeLabel = s.timeLimitSeconds === 0 ? 'Vaqtsiz (0s)' : `${s.timeLimitSeconds} soniya`;
    const shuffleQLab = s.shuffleQuestions ? '✅ Yoqilgan' : '❌ O‘chirilgan';
    const shuffleOLab = s.shuffleOptions ? '✅ Yoqilgan' : '❌ O‘chirilgan';
    const explLab = s.showExplanation ? '✅ Yoqilgan' : '❌ O‘chirilgan';

    const kb = new InlineKeyboard()
      .text(`⏱ Savol vaqti: ${timeLabel}`, 'toggle_setting_time')
      .row()
      .text(`🔀 Savollarni aralashtirish: ${shuffleQLab}`, 'toggle_setting_shuffle_q')
      .row()
      .text(`🔤 Variantlarni aralashtirish: ${shuffleOLab}`, 'toggle_setting_shuffle_o')
      .row()
      .text(`💡 To‘g‘ri javob izohi: ${explLab}`, 'toggle_setting_expl');

    const text =
      `⚙️ <b>TEST SOZLAMALARI:</b>\n\n` +
      `Ushbu sozlamalar siz yaratadigan va guruhda boshlaydigan yangi testlarga standart qo‘llanadi.\n\n` +
      `O‘zgartirish uchun kerakli tugmani bosing:`;

    if (ctx.callbackQuery) {
      try {
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb });
      } catch {
        await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
      }
    } else {
      await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
    }
  }

  private async showUserHelp(ctx: any) {
    const text =
      `<b>📖 SMART QUIZ BOT — FOYDALANISH QO‘LLANMASI</b>\n\n` +
      `<b>1. Yangi test yaratish:</b>\n` +
      `• «➕ Test yaratish» tugmasini bosing.\n` +
      `• Test mavzusini kiriting (masalan: <i>Organik kimyo</i>).\n` +
      `• Savol matnini va variantlarni yangi qatorda yuboring.\n` +
      `• Chiqqan tugmalardan to‘g‘ri javobni tanlang.\n` +
      `• «➕ Keyingi savol» tugmasi orqali xohlagancha savol kiriting va «🏁 Testni yakunlash»ni bosing.\n\n` +
      `<b>2. Guruhda jonli test o‘tkazish:</b>\n` +
      `• Botni guruhingizga qo‘shib <b>Admin</b> qiling.\n` +
      `• «📚 Testlarim» bo‘limidan test ostidagi «🚀 Boshlash» tugmasini bosing.\n` +
      `• O‘quvchilar guruhdagi «✅ Tayyorman» tugmasi orqali qatnashadilar.\n\n` +
      `<b>3. Natijalar va Excel hisobot:</b>\n` +
      `• Test yakunlangach reyting jadvali va 3 varaqli Excel hisobot tayyorlanadi.\n` +
      `• «🏆 Natijalar» bo‘limidan istalgan sessiya hisobotini yuklab olishingiz mumkin.`;

    await ctx.reply(text, { parse_mode: 'HTML' });
  }

  private async promptStartGroupSession(ctx: any, quizId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
    });
    if (!quiz) return;

    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery();
    }

    const cleanUsername = (this.config.botUsername || 'quizbot').replace(/^@/, '');
    const kb = new InlineKeyboard()
      .url('👥 Guruhga qo‘shish va boshlash', `https://t.me/${cleanUsername}?startgroup=startquiz_${quiz.id}`)
      .row()
      .text('▶️ O‘zim yechish', `start_indiv_${quiz.id}`)
      .text('📋 Savollarni ko‘rish', `view_quiz_${quiz.id}`);

    await ctx.reply(
      `🚀 <b>«${quiz.title}» testini guruhda boshlash:</b>\n\n` +
      `<b>1-usul:</b> Quyidagi <b>«👥 Guruhga qo‘shish va boshlash»</b> tugmasini bosing va guruhingizni tanlang.\n\n` +
      `<b>2-usul:</b> Agar bot allaqachon guruhingizda admin bo‘lsa, guruhingizda quyidagi buyruqni yuboring:\n` +
      `<code>/startquiz ${quiz.id}</code>`,
      { parse_mode: 'HTML', reply_markup: kb }
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
    const sub = await this.checkUserSubscription(ctx.from.id);
    if (!sub.isSubscribed) {
      const { text, reply_markup } = this.buildSubscriptionMessage(
        sub.unsubscribedChannels,
        `check_sub_join_${sessionId}`
      );
      try {
        await this.bot!.api.sendMessage(ctx.from.id, text, {
          parse_mode: 'HTML',
          reply_markup,
        });
        await ctx.answerCallbackQuery({
          text: '⚠️ Testda qatnashish uchun avval homiy kanallarga a’zo bo‘ling! Shaxsiy xabaringizga havola yuborildi.',
          show_alert: true,
        });
      } catch {
        const chList = sub.unsubscribedChannels.map((c) => c.name).join(', ');
        await ctx.answerCallbackQuery({
          text: `⚠️ Testda qatnashish uchun kanalga a’zo bo‘ling:\n${chList}\n\nSo‘ng botga /start bosing!`,
          show_alert: true,
        });
      }
      return;
    }

    const res = await this.registerParticipantInSession(ctx, sessionId, user);
    if (!res.success) {
      await ctx.answerCallbackQuery({ text: res.reason || 'Xatolik yuz berdi', show_alert: true });
      return;
    }

    await ctx.answerCallbackQuery({ text: 'Siz ro‘yxatga olindingiz! ✅' });
  }

  private async registerParticipantInSession(
    ctx: any,
    sessionId: string,
    user: any
  ): Promise<{ success: boolean; reason?: string }> {
    const session = await this.prisma.quizSession.findUnique({
      where: { id: sessionId },
      include: {
        quizVersion: true,
        participants: true,
      },
    });

    if (!session || session.status !== SessionStatus.WAITING_PARTICIPANTS) {
      return { success: false, reason: 'Test allaqachon boshlangan yoki yakunlangan!' };
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
      if (ctx.editMessageText) {
        await ctx.editMessageText(updatedLobbyText, { parse_mode: 'HTML', reply_markup: keyboard });
      }
    } catch {}

    return { success: true };
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

    const keyboard = new InlineKeyboard().text('📥 Excel Hisobot yuklab olish', `excel_report_${session.id}`);

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
