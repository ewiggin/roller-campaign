import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class TestSmtpDto {
  @ApiProperty({ example: 'test@example.com' })
  @IsEmail()
  to: string;
}
