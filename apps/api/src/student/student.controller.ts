import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { StudentService } from './student.service.js';
import { AuthGuard } from '../auth/auth.guard.js';

@Controller('student')
@UseGuards(AuthGuard)
export class StudentController {
  constructor(private studentService: StudentService) {}

  @Get('stats')
  async getStats(@Req() req: any) {
    return this.studentService.getStudentStats(req.user.id);
  }

  @Get('attempts')
  async getAttempts(@Req() req: any) {
    return this.studentService.getStudentAttempts(req.user.id);
  }
}
