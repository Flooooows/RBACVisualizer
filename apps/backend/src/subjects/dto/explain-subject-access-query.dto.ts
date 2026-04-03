import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ExplainSubjectAccessQueryDto {
  @IsString()
  @IsNotEmpty()
  importId!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  projectId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  resource?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  verb?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  namespace?: string;
}
