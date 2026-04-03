import { Controller, Get, Query } from '@nestjs/common';
import { AccessResolutionService } from '../access-resolution/access-resolution.service';
import { GetGraphQueryDto } from './dto/get-graph-query.dto';

@Controller('graph')
export class GraphController {
  private readonly accessResolutionService: AccessResolutionService;

  constructor(accessResolutionService: AccessResolutionService) {
    this.accessResolutionService = accessResolutionService;
  }

  @Get()
  getGraph(@Query() query: GetGraphQueryDto): Promise<unknown> {
    return this.accessResolutionService.getSubjectFocusGraph({
      importId: query.importId,
      projectId: query.projectId,
      subjectId: query.subjectId,
      namespace: query.namespace,
      includePermissions: query.includePermissions,
    });
  }
}
