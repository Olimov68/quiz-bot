import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class QuestionBankService {
  constructor(private prisma: PrismaService) {}

  async listQuestions(teacherId: string, subject?: string, search?: string) {
    const where: any = { teacherId };
    if (subject) where.subject = subject;
    if (search) {
      where.OR = [
        { text: { contains: search, mode: 'insensitive' } },
        { topic: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.questionBankItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createQuestion(teacherId: string, data: any) {
    return this.prisma.questionBankItem.create({
      data: {
        teacherId,
        subject: data.subject || 'Umumiy',
        topic: data.topic || null,
        difficulty: data.difficulty || 'MEDIUM',
        tags: data.tags || [],
        text: data.text,
        explanation: data.explanation || null,
        options: data.options || [],
      },
    });
  }

  async deleteQuestion(id: string, teacherId: string) {
    const item = await this.prisma.questionBankItem.findUnique({ where: { id } });
    if (!item || item.teacherId !== teacherId) {
      throw new NotFoundException('Savol topilmadi');
    }
    await this.prisma.questionBankItem.delete({ where: { id } });
    return { success: true };
  }
}
