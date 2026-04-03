import { Module } from '@nestjs/common';
import { ImportsModule } from '../imports/imports.module';
import { ClusterConnectionsController } from './cluster-connections.controller';
import { ClusterConnectionsService } from './cluster-connections.service';

@Module({
  imports: [ImportsModule],
  controllers: [ClusterConnectionsController],
  providers: [ClusterConnectionsService],
})
export class ClusterConnectionsModule {}
