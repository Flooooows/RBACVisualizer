import { Controller, Get, Query } from '@nestjs/common';
import { AccessResolutionService } from '../access-resolution/access-resolution.service';
import { GetResourceAccessQueryDto } from './dto/get-resource-access-query.dto';

@Controller('resources')
export class ResourcesController {
  private readonly accessResolutionService: AccessResolutionService;

  constructor(accessResolutionService: AccessResolutionService) {
    this.accessResolutionService = accessResolutionService;
  }

  @Get('access')
  getResourceAccess(@Query() query: GetResourceAccessQueryDto): Promise<unknown> {
    return this.accessResolutionService.getResourceAccess({
      importId: query.importId,
      resource: query.resource ?? '*',
      verb: query.verb ?? '*',
      namespace: query.namespace,
    });
  }
}
