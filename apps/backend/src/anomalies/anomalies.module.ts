import { Module } from '@nestjs/common';
import { AnomaliesController } from './anomalies.controller';

@Module({
  controllers: [AnomaliesController],
})
export class AnomaliesModule {}
