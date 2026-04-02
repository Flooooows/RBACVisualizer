import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ClusterStatusDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  kubeconfigPath?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  contextName?: string;
}
