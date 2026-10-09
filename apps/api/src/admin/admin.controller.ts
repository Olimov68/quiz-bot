import { Controller, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { RolesGuard, Roles } from '../auth/roles.guard.js';
import { UserRole } from '@smart-quiz/shared';

@Controller('admin')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('stats')
  async getStats() {
    return this.adminService.getPlatformStats();
  }

  @Get('users')
  async getUsers(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string
  ) {
    return this.adminService.listUsers(parseInt(page, 10), parseInt(limit, 10), search);
  }

  @Patch('users/:id/status')
  async toggleStatus(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.adminService.toggleUserStatus(id, body.isActive);
  }

  @Get('audit-logs')
  async getAuditLogs() {
    return this.adminService.getAuditLogs();
  }
}
