import { Module } from '@nestjs/common';
import { ImportService } from './import.service.js';
import { ImportController } from './import.controller.js';

@Module({
  controllers: [ImportController],
  providers: [ImportService],
  exports: [ImportService],
})
export class ImportModule {}
