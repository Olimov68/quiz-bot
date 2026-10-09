import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadConfig } from './config/configuration.js';
import express from 'express';
import path from 'node:path';

async function bootstrap() {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule);

  // Global API prefix
  app.setGlobalPrefix('api');

  // CORS configuration
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Body parser size limits
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Static media storage serving
  app.use('/media', express.static(path.resolve(config.mediaStoragePath)));

  const port = config.apiPort;
  await app.listen(port);

  console.log(`
=====================================================
🚀 SMART QUIZ PLATFORM - BACKEND API IS READY
=====================================================
📡 API Server URL:       http://localhost:${port}/api
🌐 Public Web / App:     ${config.publicWebUrl}
🤖 Telegram Bot Username: @${config.botUsername}
📊 Environment:          ${config.nodeEnv}
=====================================================
  `);
}

bootstrap();
