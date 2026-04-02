import { IsNotEmpty, IsString } from 'class-validator';

export class ImportIdQueryDto {
  @IsString()
  @IsNotEmpty()
  importId!: string;
}
