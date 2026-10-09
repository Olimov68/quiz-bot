import { Module } from '@nestjs/common';
import { TelegramBotService } from './telegram-bot.service.js';
import { TelegramBotController } from './telegram-bot.controller.js';

@Module({
  controllers: [TelegramBotController],
  providers: [TelegramBotService],
  exports: [TelegramBotService],
})
export class TelegramBotModule {}
