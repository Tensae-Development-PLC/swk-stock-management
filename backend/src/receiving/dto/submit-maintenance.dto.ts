import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class SubmitMaintenanceDto {
  @ApiProperty({ example: 'TL4G002' })
  @IsString()
  serialNumber: string;

  @ApiProperty({ example: 'Binyam' })
  @IsString()
  @MinLength(2)
  performedByName: string;

  @ApiProperty({ example: '0912345678' })
  @IsString()
  @MinLength(7)
  performedByPhone: string;

  @ApiProperty({ example: 9.03 })
  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: 38.74 })
  @Type(() => Number)
  @IsNumber()
  longitude: number;

  @ApiProperty({ example: 12.5 })
  @Type(() => Number)
  @IsNumber()
  accuracy: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
