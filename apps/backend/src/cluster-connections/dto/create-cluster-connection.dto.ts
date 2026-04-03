import { ClusterProvider } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateClusterConnectionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  projectId?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsEnum(ClusterProvider)
  provider?: ClusterProvider;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  kubeconfigPath?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  contextName?: string;
}
