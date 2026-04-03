import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ProjectImportQueryDto {
  @IsString()
  @IsNotEmpty()
  importId!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  projectId?: string;
}
