import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@smart-quiz/database';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    try {
      await this.$connect();
      console.log('✅ PostgreSQL / Prisma connected successfully');
    } catch (err: any) {
      console.warn('⚠️ Prisma connection warning (running in degraded/reconnect mode):', err.message);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
