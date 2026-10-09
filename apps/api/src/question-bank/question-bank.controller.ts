import { Controller, Get, Post, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { QuestionBankService } from './question-bank.service.js';
import { AuthGuard } from '../auth/auth.guard.js';

@Controller('question-bank')
@UseGuards(AuthGuard)
export class QuestionBankController {
  constructor(private questionBankService: QuestionBankService) {}

  @Get()
  async list(@Req() req: any, @Query('subject') subject?: string, @Query('search') search?: string) {
    return this.questionBankService.listQuestions(req.user.id, subject, search);
  }

  @Post()
  async create(@Req() req: any, @Body() body: any) {
    return this.questionBankService.createQuestion(req.user.id, body);
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    return this.questionBankService.deleteQuestion(id, req.user.id);
  }
}
