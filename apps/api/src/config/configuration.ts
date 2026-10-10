import crypto from 'node:crypto';
import dotenv from 'dotenv';
dotenv.config();

export interface AppConfig {
  nodeEnv: string;
  botToken: string;
  botUsername: string;
  databaseUrl: string;
  redisUrl: string;
  apiPort: number;
  webPort: number;
  publicApiUrl: string;
  publicWebUrl: string;
  telegramWebhookUrl: string;
  telegramWebhookSecret: string;
  superAdminTelegramIds: string[];
  jwtSecret: string;
  mediaStoragePath: string;
  tempStoragePath: string;
  maxDocxSizeMb: number;
  maxImportQuestions: number;
  requiredChannels: string[];
}

let devGeneratedJwtSecret: string | null = null;

export function loadConfig(): AppConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const superAdminIdsRaw = process.env.SUPER_ADMIN_TELEGRAM_IDS || '';
  const superAdminTelegramIds = superAdminIdsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  let jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.trim() === '' || jwtSecret === 'smart_quiz_platform_default_jwt_secret_key_32chars') {
    if (nodeEnv === 'production') {
      throw new Error(
        'KRITIK XAVFSIZLIK XATOSI: Ishlab chiqarish (production) muhitida kuchli JWT_SECRET (.env) ko‘rsatilishi shart! Standart yoki bo‘sh kalitdan foydalanish qat’iyan taqiqlanadi.'
      );
    } else {
      // In development, generate a cryptographically secure random secret per process
      if (!devGeneratedJwtSecret) {
        devGeneratedJwtSecret = crypto.randomBytes(32).toString('hex');
      }
      jwtSecret = devGeneratedJwtSecret;
    }
  }

  const telegramWebhookUrl = process.env.TELEGRAM_WEBHOOK_URL || '';
  const telegramWebhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || '';

  if (nodeEnv === 'production' && telegramWebhookUrl && !telegramWebhookSecret) {
    throw new Error(
      'KRITIK XAVFSIZLIK XATOSI: Telegram Webhook yoqilgan bo‘lsa, TELEGRAM_WEBHOOK_SECRET (.env) ko‘rsatilishi shart!'
    );
  }

  const requiredChannelsRaw = process.env.REQUIRED_CHANNELS || '';
  const requiredChannels = requiredChannelsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    nodeEnv,
    botToken: process.env.BOT_TOKEN || '',
    botUsername: process.env.BOT_USERNAME || 'smartquiz_bot',
    databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/smart_quiz_platform?schema=public',
    redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    apiPort: parseInt(process.env.API_PORT || '4000', 10),
    webPort: parseInt(process.env.WEB_PORT || '3000', 10),
    publicApiUrl: process.env.PUBLIC_API_URL || 'http://localhost:4000',
    publicWebUrl: process.env.PUBLIC_WEB_URL || 'http://localhost:3000',
    telegramWebhookUrl,
    telegramWebhookSecret,
    superAdminTelegramIds,
    jwtSecret,
    mediaStoragePath: process.env.MEDIA_STORAGE_PATH || './storage/media',
    tempStoragePath: process.env.TEMP_STORAGE_PATH || './storage/temp',
    maxDocxSizeMb: parseInt(process.env.MAX_DOCX_SIZE_MB || '20', 10),
    maxImportQuestions: parseInt(process.env.MAX_IMPORT_QUESTIONS || '500', 10),
    requiredChannels,
  };
}
