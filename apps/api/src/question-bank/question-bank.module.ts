import { Module } from '@nestjs/common';
import { QuestionBankService } from './question-bank.service.js';
import { QuestionBankController } from './question-bank.controller.js';

@Module({
  controllers: [QuestionBankController],
  providers: [QuestionBankService],
  exports: [QuestionBankService],
})
export class QuestionBankModule {}
