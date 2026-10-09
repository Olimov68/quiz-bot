import { Controller, Post, Body, Req, Headers, HttpCode } from '@nestjs/common';
import { TelegramBotService } from './telegram-bot.service.js';
import { loadConfig } from '../config/configuration.js';

@Controller('bot')
export class TelegramBotController {
  private config = loadConfig();

  constructor(private botService: TelegramBotService) {}

  /**
   * Telegram Webhook handler endpoint
   */
  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Body() update: any,
    @Headers('x-telegram-bot-api-secret-token') secretHeader?: string
  ) {
    if (this.config.telegramWebhookSecret && secretHeader !== this.config.telegramWebhookSecret) {
      return { error: 'Unauthorized secret token' };
    }

    const bot = this.botService.getBot();
    if (bot) {
      await bot.handleUpdate(update);
    }
    return { ok: true };
  }
}
