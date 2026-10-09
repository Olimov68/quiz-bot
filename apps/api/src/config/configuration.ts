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
}

export function loadConfig(): AppConfig {
  const superAdminIdsRaw = process.env.SUPER_ADMIN_TELEGRAM_IDS || '';
  const superAdminTelegramIds = superAdminIdsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    botToken: process.env.BOT_TOKEN || '',
    botUsername: process.env.BOT_USERNAME || 'smartquiz_bot',
    databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/smart_quiz_platform?schema=public',
    redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    apiPort: parseInt(process.env.API_PORT || '4000', 10),
    webPort: parseInt(process.env.WEB_PORT || '3000', 10),
    publicApiUrl: process.env.PUBLIC_API_URL || 'http://localhost:4000',
    publicWebUrl: process.env.PUBLIC_WEB_URL || 'http://localhost:3000',
    telegramWebhookUrl: process.env.TELEGRAM_WEBHOOK_URL || '',
    telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
    superAdminTelegramIds,
    jwtSecret: process.env.JWT_SECRET || 'smart_quiz_platform_default_jwt_secret_key_32chars',
    mediaStoragePath: process.env.MEDIA_STORAGE_PATH || './storage/media',
    tempStoragePath: process.env.TEMP_STORAGE_PATH || './storage/temp',
    maxDocxSizeMb: parseInt(process.env.MAX_DOCX_SIZE_MB || '20', 10),
    maxImportQuestions: parseInt(process.env.MAX_IMPORT_QUESTIONS || '500', 10),
  };
}
