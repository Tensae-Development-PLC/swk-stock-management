import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@swk.local' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Admin@SWK2026!' })
  @IsString()
  @MinLength(8)
  password: string;
}
