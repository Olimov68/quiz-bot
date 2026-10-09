import { Global, Module } from '@nestjs/common';
import { QuizQueueService } from './quiz-queue.service.js';

@Global()
@Module({
  providers: [QuizQueueService],
  exports: [QuizQueueService],
})
export class QuizQueueModule {}
