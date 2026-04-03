import { Controller, Get, Query } from '@nestjs/common';
import { AccessResolutionService } from '../access-resolution/access-resolution.service';
import { ImportIdQueryDto } from '../common/dto/import-id-query.dto';

@Controller('anomalies')
export class AnomaliesController {
  private readonly accessResolutionService: AccessResolutionService;

  constructor(accessResolutionService: AccessResolutionService) {
    this.accessResolutionService = accessResolutionService;
  }

  @Get()
  getAnomalies(@Query() query: ImportIdQueryDto): Promise<unknown> {
    return this.accessResolutionService.listAnomalies(query.importId, query.projectId);
  }
}
