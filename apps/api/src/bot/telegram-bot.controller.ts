import { Controller, Post, Body, Headers, HttpCode, UnauthorizedException } from '@nestjs/common';
import { TelegramBotService } from './telegram-bot.service.js';
import { loadConfig, AppConfig } from '../config/configuration.js';

@Controller('bot')
export class TelegramBotController {
  private config: AppConfig;

  constructor(private botService: TelegramBotService) {
    this.config = loadConfig();
  }

  /**
   * Telegram Webhook handler endpoint
   * STRICT SECURITY: Rejects any request missing the valid x-telegram-bot-api-secret-token.
   */
  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Body() update: any,
    @Headers('x-telegram-bot-api-secret-token') secretHeader?: string
  ) {
    if (!this.config.telegramWebhookSecret) {
      throw new UnauthorizedException('Serverda TELEGRAM_WEBHOOK_SECRET sozlanmagan');
    }

    if (!secretHeader || secretHeader !== this.config.telegramWebhookSecret) {
      throw new UnauthorizedException('Telegram webhook maxfiy tokeni noto‘g‘ri yoki mavjud emas');
    }

    const bot = this.botService.getBot();
    if (bot) {
      await bot.handleUpdate(update);
    }
    return { ok: true };
  }
}
