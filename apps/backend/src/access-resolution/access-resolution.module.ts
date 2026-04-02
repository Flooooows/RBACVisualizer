import { Global, Module } from '@nestjs/common';
import { AccessResolutionService } from './access-resolution.service';

@Global()
@Module({
  providers: [AccessResolutionService],
  exports: [AccessResolutionService],
})
export class AccessResolutionModule {}
