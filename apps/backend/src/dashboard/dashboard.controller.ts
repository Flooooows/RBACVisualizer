import { Controller, Get, Query } from '@nestjs/common';
import { AccessResolutionService } from '../access-resolution/access-resolution.service';
import { ImportIdQueryDto } from '../common/dto/import-id-query.dto';

@Controller('dashboard')
export class DashboardController {
  private readonly accessResolutionService: AccessResolutionService;

  constructor(accessResolutionService: AccessResolutionService) {
    this.accessResolutionService = accessResolutionService;
  }

  @Get()
  getDashboard(@Query() query: ImportIdQueryDto): Promise<unknown> {
    return this.accessResolutionService.getDashboard(query.importId, query.projectId);
  }
}
