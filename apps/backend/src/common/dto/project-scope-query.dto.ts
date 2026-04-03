import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ProjectScopeQueryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  projectId?: string;
}
