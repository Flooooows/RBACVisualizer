import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GetResourceAccessQueryDto {
  @IsString()
  @IsNotEmpty()
  importId!: string;

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
