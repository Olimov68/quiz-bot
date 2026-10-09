import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { QuizzesModule } from './quizzes/quizzes.module.js';
import { ImportModule } from './import/import.module.js';
import { SessionsModule } from './sessions/sessions.module.js';
import { ExportModule } from './export/export.module.js';
import { QuestionBankModule } from './question-bank/question-bank.module.js';
import { StudentModule } from './student/student.module.js';
import { AdminModule } from './admin/admin.module.js';
import { TelegramBotModule } from './bot/telegram-bot.module.js';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    QuizzesModule,
    ImportModule,
    SessionsModule,
    ExportModule,
    QuestionBankModule,
    StudentModule,
    AdminModule,
    TelegramBotModule,
  ],
})
export class AppModule {}
