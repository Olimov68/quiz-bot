import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { loadConfig } from '../config/configuration.js';
import { parseDocxBuffer } from '@smart-quiz/docx-parser';
import { DocxParseResult, QuizStatus, UserRole } from '@smart-quiz/shared';

@Injectable()
export class ImportService {
  private config = loadConfig();

  constructor(private prisma: PrismaService) {
    this.ensureStorageDirs();
  }

  private ensureStorageDirs() {
    if (!fs.existsSync(this.config.mediaStoragePath)) {
      fs.mkdirSync(this.config.mediaStoragePath, { recursive: true });
    }
    if (!fs.existsSync(this.config.tempStoragePath)) {
      fs.mkdirSync(this.config.tempStoragePath, { recursive: true });
    }
  }

  async parseUploadedDocx(file: Express.Multer.File, userId: string): Promise<DocxParseResult & { importJobId: string }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Fayl yuklanmadi');
    }

    // Verify magic bytes: PK (0x50, 0x4B) for zip/docx
    if (file.buffer.length < 4 || file.buffer[0] !== 0x50 || file.buffer[1] !== 0x4b) {
      throw new BadRequestException('Fayl formati noto‘g‘ri. Faqat Word (.docx) fayllar qabul qilinadi.');
    }

    // Parse DOCX
    const parseResult = await parseDocxBuffer(file.buffer);

    // Save extracted images to media storage
    const savedMediaMap = new Map<string, string>(); // hash -> mediaAssetId
    for (const q of parseResult.questions) {
      for (const img of q.images) {
        if (img.buffer && !savedMediaMap.has(img.hash)) {
          const ext = img.mimeType.split('/').pop() || 'png';
          const filename = `${crypto.randomUUID()}.${ext}`;
          const filePath = path.join(this.config.mediaStoragePath, filename);
          fs.writeFileSync(filePath, img.buffer);

          const mediaRecord = await this.prisma.mediaAsset.create({
            data: {
              originalName: img.originalName,
              fileName: filename,
              mimeType: img.mimeType,
              sizeBytes: img.buffer.length,
              path: filePath,
              url: `/media/${filename}`,
              ownerId: userId,
            },
          });
          savedMediaMap.set(img.hash, mediaRecord.id);
        }
      }
    }

    // Create ImportJob record in DB
    const importJob = await this.prisma.importJob.create({
      data: {
        userId,
        originalFileName: file.originalname,
        fileSizeBytes: file.size,
        status: parseResult.success ? 'COMPLETED' : 'FAILED',
        totalQuestions: parseResult.totalQuestions,
        validQuestions: parseResult.validQuestions,
        invalidQuestions: parseResult.invalidQuestions,
        imagesCount: parseResult.imagesCount,
        formulasCount: parseResult.formulasCount,
        issues: {
          create: parseResult.questions.flatMap((q) =>
            q.issues.map((iss) => ({
              questionIndex: q.index,
              issueType: iss.type,
              description: iss.message,
            }))
          ),
        },
      },
    });

    return {
      ...parseResult,
      importJobId: importJob.id,
    };
  }

  async convertImportToQuiz(userId: string, data: { title: string; description?: string; subject?: string; questions: any[] }) {
    const quiz = await this.prisma.quiz.create({
      data: {
        title: data.title,
        description: data.description || null,
        subject: data.subject || 'Umumiy',
        creatorId: userId,
        status: QuizStatus.PUBLISHED,
        currentVersion: 1,
        versions: {
          create: {
            versionNumber: 1,
            title: data.title,
            description: data.description || null,
            questions: {
              create: data.questions.map((q: any, idx: number) => ({
                questionIndex: idx + 1,
                text: q.text,
                explanation: q.explanation || null,
                hasMath: Boolean(q.hasMath),
                hasChemistry: Boolean(q.hasChemistry),
                points: q.points || 1,
                options: {
                  create: q.options.map((opt: any, optIdx: number) => ({
                    optionIndex: optIdx,
                    text: opt.text,
                    isCorrect: Boolean(opt.isCorrect),
                  })),
                },
              })),
            },
          },
        },
      },
    });

    return quiz;
  }
}
