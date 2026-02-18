import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({ example: 'My Amazing Story', description: 'Title of the work' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({
    example: 'A thrilling adventure...',
    description: 'Description of the work',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: 'novel',
    description: 'Type of the work',
    default: 'novel',
  })
  @IsString()
  @IsOptional()
  type?: string = 'novel';

  @ApiPropertyOptional({
    example: 2000,
    description: 'Character limit per page',
    default: 2000,
  })
  @IsNumber()
  @IsOptional()
  @Min(100)
  @Max(10000)
  pageCharLimit?: number = 2000;

  @ApiPropertyOptional({
    example: true,
    description: 'Allow other users to contribute',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  allowCollaboration?: boolean = true;
}
