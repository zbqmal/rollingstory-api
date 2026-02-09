import { IsString, IsNotEmpty } from 'class-validator';

export class CreatePageDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}
