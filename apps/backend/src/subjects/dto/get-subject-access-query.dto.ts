import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GetSubjectAccessQueryDto {
  @IsString()
  @IsNotEmpty()
  importId!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  namespace?: string;
}
