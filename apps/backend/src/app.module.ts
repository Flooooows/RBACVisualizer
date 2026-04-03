import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { ImportsModule } from './imports/imports.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { GraphModule } from './graph/graph.module';
import { SubjectsModule } from './subjects/subjects.module';
import { ResourcesModule } from './resources/resources.module';
import { AnomaliesModule } from './anomalies/anomalies.module';
import { PersistenceModule } from './persistence/persistence.module';
import { AccessResolutionModule } from './access-resolution/access-resolution.module';
import { ProjectsModule } from './projects/projects.module';
import { ClusterConnectionsModule } from './cluster-connections/cluster-connections.module';

@Module({
  imports: [
    ImportsModule,
    DashboardModule,
    GraphModule,
    SubjectsModule,
    ResourcesModule,
    AnomaliesModule,
    PersistenceModule,
    AccessResolutionModule,
    ProjectsModule,
    ClusterConnectionsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
