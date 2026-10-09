import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportService } from './import.service.js';
import { AuthGuard } from '../auth/auth.guard.js';

@Controller('import')
@UseGuards(AuthGuard)
export class ImportController {
  constructor(private importService: ImportService) {}

  @Post('docx')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocx(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('Word (.docx) faylini tanlang');
    }
    return this.importService.parseUploadedDocx(file, req.user.id);
  }

  @Post('save-quiz')
  async saveQuiz(@Body() body: any, @Req() req: any) {
    return this.importService.convertImportToQuiz(req.user.id, body);
  }
}
