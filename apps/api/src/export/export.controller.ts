import { Controller, Get, Param, Res, Req, UseGuards, ForbiddenException } from '@nestjs/common';
import { Response } from 'express';
import { ExportService } from './export.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { PrismaService } from '../database/prisma.service.js';
import { UserRole } from '@smart-quiz/shared';

@Controller('export')
export class ExportController {
  constructor(
    private exportService: ExportService,
    private prisma: PrismaService
  ) {}

  @Get('session/:id/excel')
  @UseGuards(AuthGuard)
  async exportExcel(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
    const session = await this.prisma.quizSession.findUnique({
      where: { id },
      select: { createdById: true },
    });

    if (!session) {
      throw new ForbiddenException('Sessiya topilmadi');
    }

    // PRIVACY / SECURITY: Only session creator or super admin can export group Excel report
    if (session.createdById !== req.user.id && req.user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Ushbu sessiya hisobotini yuklab olish huquqiga ega emassiz');
    }

    const { buffer, filename } = await this.exportService.exportSessionToExcel(id);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
