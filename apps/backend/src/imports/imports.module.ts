import { Module } from '@nestjs/common';
import { ClusterRbacReaderService } from './cluster-rbac-reader.service';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  controllers: [ImportsController],
  providers: [ImportsService, ClusterRbacReaderService],
  exports: [ImportsService, ClusterRbacReaderService],
})
export class ImportsModule {}
