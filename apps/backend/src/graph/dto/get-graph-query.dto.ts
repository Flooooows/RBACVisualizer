import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GetGraphQueryDto {
  @IsString()
  @IsNotEmpty()
  importId!: string;

  @IsString()
  @IsNotEmpty()
  subjectId!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  namespace?: string;

  @IsOptional()
  @Transform(({ value }) => value !== 'false')
  @IsBoolean()
  includePermissions?: boolean;
}
