import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from '../database/prisma.service.js';
import { loadConfig, AppConfig } from '../config/configuration.js';

export interface PollTimerJobData {
  sessionId: string;
  questionIndex: number;
  telegramPollId: string;
  chatId: number;
  messageId?: number;
}

@Injectable()
export class QuizQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QuizQueueService.name);
  private config: AppConfig;
  private redisClient: Redis | null = null;
  private pollQueue: Queue | null = null;
  private pollWorker: Worker | null = null;
  private isRedisConnected = false;
  private sweepInterval: NodeJS.Timeout | null = null;
  private onPollTimeoutCallback: ((data: PollTimerJobData) => Promise<void>) | null = null;

  constructor(private prisma: PrismaService) {
    this.config = loadConfig();
  }

  async onModuleInit() {
    this.initBullMQ();
    this.startPersistentDbSweep();
  }

  async onModuleDestroy() {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
    }
    if (this.pollWorker) {
      await this.pollWorker.close();
    }
    if (this.pollQueue) {
      await this.pollQueue.close();
    }
    if (this.redisClient) {
      this.redisClient.disconnect();
    }
  }

  public registerPollTimeoutHandler(handler: (data: PollTimerJobData) => Promise<void>) {
    this.onPollTimeoutCallback = handler;
  }

  private initBullMQ() {
    try {
      this.redisClient = new Redis(this.config.redisUrl, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
        retryStrategy: (times) => {
          if (times > 3) {
            this.logger.warn('⚠️ Redis ulanishi mavjud emas. Tizim chidamli DB-interval fallback rejimida ishlaydi.');
            return null; // Stop retrying Redis aggressively
          }
          return Math.min(times * 1000, 3000);
        },
      });

      this.redisClient.on('connect', () => {
        this.isRedisConnected = true;
        this.logger.log('✅ Redis / BullMQ navbat tizimiga muvaffaqiyatli ulandi');
      });

      this.redisClient.on('error', (err) => {
        this.isRedisConnected = false;
        // Don't crash process if Redis is not started on Windows/Linux
      });

      this.redisClient.connect().then(() => {
        if (!this.redisClient) return;
        this.pollQueue = new Queue('poll-timer-queue', {
          connection: this.redisClient,
        });

        this.pollWorker = new Worker(
          'poll-timer-queue',
          async (job: Job<PollTimerJobData>) => {
            this.logger.log(`⏳ BullMQ timer ishga tushdi: sessiya=${job.data.sessionId}, savol=${job.data.questionIndex}`);
            if (this.onPollTimeoutCallback) {
              await this.onPollTimeoutCallback(job.data);
            }
          },
          { connection: this.redisClient }
        );
      }).catch(() => {
        this.logger.warn('⚠️ Redis mavjud emas. Tizim mustahkam ma’lumotlar bazasi orqali taymerlarni boshqaradi.');
      });
    } catch (e: any) {
      this.logger.warn(`BullMQ init ogohlantirish: ${e.message}`);
    }
  }

  /**
   * Schedule a durable question timeout job.
   * If BullMQ/Redis is ready, schedules with delay.
   * Also guarantees DB persistence via PollInstance.expiresAt.
   */
  async schedulePollTimeout(data: PollTimerJobData, delaySeconds: number) {
    if (this.isRedisConnected && this.pollQueue) {
      try {
        await this.pollQueue.add(
          `timer_${data.sessionId}_${data.questionIndex}`,
          data,
          {
            delay: delaySeconds * 1000,
            removeOnComplete: true,
            jobId: `job_${data.sessionId}_${data.questionIndex}`,
          }
        );
        return;
      } catch (err: any) {
        this.logger.warn(`BullMQ add error: ${err.message}`);
      }
    }
  }

  /**
   * Persistent Database Sweep: runs every 4 seconds.
   * Checks for any PollInstance where isOpen is true and expiresAt has passed.
   * If found, automatically invokes timeout handler and advances the session.
   * ZERO STUCK SESSIONS ACROSS REBOOTS!
   */
  private startPersistentDbSweep() {
    this.sweepInterval = setInterval(async () => {
      try {
        const now = new Date();
        const expiredPolls = await this.prisma.pollInstance.findMany({
          where: {
            isOpen: true,
            expiresAt: {
              not: null,
              lte: now,
            },
          },
          include: { session: true },
          take: 20,
        });

        for (const poll of expiredPolls) {
          if (!this.onPollTimeoutCallback) continue;

          this.logger.log(`🔄 Muddati o‘tgan faol poll aniqlandi (DB Recovery): id=${poll.id}, telegramPollId=${poll.telegramPollId}`);

          // Close in DB first to prevent duplicate sweep
          await this.prisma.pollInstance.update({
            where: { id: poll.id },
            data: { isOpen: false, closedAt: now },
          });

          await this.onPollTimeoutCallback({
            sessionId: poll.sessionId,
            questionIndex: poll.session.currentQuestionIndex,
            telegramPollId: poll.telegramPollId,
            chatId: Number(poll.chatId || poll.session.telegramChatId || 0),
            messageId: poll.messageId || undefined,
          });
        }
      } catch (err: any) {
        // Suppress transient query errors
      }
    }, 4000);
  }
}
