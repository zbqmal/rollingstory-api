import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreatePageDto {
  @ApiProperty({
    example: 'Once upon a time in a land far away...',
    description: 'Content of the page',
  })
  @IsString()
  @IsNotEmpty()
  content: string;
}
