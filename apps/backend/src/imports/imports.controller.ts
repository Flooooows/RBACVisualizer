import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { IdParamDto } from '../common/dto/id-param.dto';
import { ClusterStatusDto } from './dto/cluster-status.dto';
import { CreateClusterImportDto } from './dto/create-cluster-import.dto';
import { ImportsService } from './imports.service';

@Controller('imports')
export class ImportsController {
  private readonly importsService: ImportsService;

  constructor(importsService: ImportsService) {
    this.importsService = importsService;
  }

  @Post()
  createImport(
    @Body() body: unknown,
    @Headers('content-type') contentType?: string,
  ): Promise<unknown> {
    return this.importsService.createImport({ body, contentType });
  }

  @Post('cluster')
  createClusterImport(@Body() body: CreateClusterImportDto): Promise<unknown> {
    return this.importsService.createClusterImport(body);
  }

  @Post('cluster/status')
  getClusterStatus(@Body() body: ClusterStatusDto): Promise<unknown> {
    return this.importsService.getClusterStatus(body);
  }

  @Get()
  getImports(): Promise<unknown> {
    return this.importsService.listImports();
  }

  @Get(':id')
  getImportById(@Param() params: IdParamDto): Promise<unknown> {
    return this.importsService.getImportById(params.id);
  }
}
