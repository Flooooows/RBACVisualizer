import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateClusterImportDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  projectId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  kubeconfigPath?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  contextName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sourceLabel?: string;
}
