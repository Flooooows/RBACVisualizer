import { Controller, Get, Param, Query } from '@nestjs/common';
import { AccessResolutionService } from '../access-resolution/access-resolution.service';
import { IdParamDto } from '../common/dto/id-param.dto';
import { ExplainSubjectAccessQueryDto } from './dto/explain-subject-access-query.dto';
import { GetSubjectAccessQueryDto } from './dto/get-subject-access-query.dto';
import { GetSubjectsQueryDto } from './dto/get-subjects-query.dto';

@Controller('subjects')
export class SubjectsController {
  private readonly accessResolutionService: AccessResolutionService;

  constructor(accessResolutionService: AccessResolutionService) {
    this.accessResolutionService = accessResolutionService;
  }

  @Get()
  getSubjects(@Query() query: GetSubjectsQueryDto): Promise<unknown> {
    return this.accessResolutionService.listSubjects(query);
  }

  @Get(':id')
  getSubject(
    @Param() params: IdParamDto,
    @Query() query: GetSubjectAccessQueryDto,
  ): Promise<unknown> {
    return this.accessResolutionService.getSubjectAccess({
      importId: query.importId,
      projectId: query.projectId,
      subjectId: params.id,
    });
  }

  @Get(':id/access')
  getSubjectAccess(
    @Param() params: IdParamDto,
    @Query() query: GetSubjectAccessQueryDto,
  ): Promise<unknown> {
    return this.accessResolutionService.getSubjectAccess({
      importId: query.importId,
      projectId: query.projectId,
      subjectId: params.id,
      namespace: query.namespace,
    });
  }

  @Get(':id/explain')
  explainSubjectAccess(
    @Param() params: IdParamDto,
    @Query() query: ExplainSubjectAccessQueryDto,
  ): Promise<unknown> {
    return this.accessResolutionService.explainSubjectAccess({
      importId: query.importId,
      projectId: query.projectId,
      subjectId: params.id,
      resource: query.resource ?? '*',
      verb: query.verb ?? '*',
      namespace: query.namespace,
    });
  }
}
