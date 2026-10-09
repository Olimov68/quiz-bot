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

  // Security headers for static media storage serving
  app.use(
    '/media',
    express.static(path.resolve(config.mediaStoragePath), {
      dotfiles: 'ignore',
      index: false,
      maxAge: '7d',
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:;");
      },
    })
  );

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
