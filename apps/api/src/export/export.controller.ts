import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ExportService } from './export.service.js';
import { AuthGuard } from '../auth/auth.guard.js';

@Controller('export')
export class ExportController {
  constructor(private exportService: ExportService) {}

  @Get('session/:id/excel')
  async exportExcel(@Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.exportService.exportSessionToExcel(id);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
