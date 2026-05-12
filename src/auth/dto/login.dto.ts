import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@roller.local' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'contraseña-segura' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
