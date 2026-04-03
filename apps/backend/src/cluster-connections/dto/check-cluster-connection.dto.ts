import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CheckClusterConnectionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  projectId?: string;
}
