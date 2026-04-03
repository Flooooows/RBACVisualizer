import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateClusterConnectionImportDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  projectId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  sourceLabel?: string;
}
