import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IdParamDto } from '../common/dto/id-param.dto';
import { ProjectScopeQueryDto } from '../common/dto/project-scope-query.dto';
import { ClusterConnectionsService } from './cluster-connections.service';
import { CheckClusterConnectionDto } from './dto/check-cluster-connection.dto';
import { CreateClusterConnectionImportDto } from './dto/create-cluster-connection-import.dto';
import { CreateClusterConnectionDto } from './dto/create-cluster-connection.dto';

@Controller('cluster-connections')
export class ClusterConnectionsController {
  constructor(private readonly clusterConnectionsService: ClusterConnectionsService) {}

  @Get()
  list(@Query() query: ProjectScopeQueryDto): Promise<unknown> {
    return this.clusterConnectionsService.list(query.projectId);
  }

  @Post()
  create(@Body() body: CreateClusterConnectionDto): Promise<unknown> {
    return this.clusterConnectionsService.create(body);
  }

  @Post(':id/check')
  check(@Param() params: IdParamDto, @Body() body: CheckClusterConnectionDto): Promise<unknown> {
    return this.clusterConnectionsService.check(params.id, body.projectId);
  }

  @Post(':id/import')
  triggerImport(
    @Param() params: IdParamDto,
    @Body() body: CreateClusterConnectionImportDto,
  ): Promise<unknown> {
    return this.clusterConnectionsService.import(params.id, body);
  }
}
