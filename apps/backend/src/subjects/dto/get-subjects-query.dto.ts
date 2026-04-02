import { SubjectKind } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GetSubjectsQueryDto {
  @IsString()
  @IsNotEmpty()
  importId!: string;

  @IsOptional()
  @IsEnum(SubjectKind)
  type?: SubjectKind;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  search?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  namespace?: string;
}
