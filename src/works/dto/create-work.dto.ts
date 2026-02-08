import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class CreateWorkDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  type?: string = 'novel';

  @IsNumber()
  @IsOptional()
  @Min(100)
  @Max(10000)
  pageCharLimit?: number = 2000;

  @IsBoolean()
  @IsOptional()
  allowCollaboration?: boolean = true;
}
