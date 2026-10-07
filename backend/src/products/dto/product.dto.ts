import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateProductDto {
  @ApiPropertyOptional({ example: '001', description: 'Optional; auto-assigned when omitted' })
  @IsOptional()
  @IsString()
  bcNumber?: string;

  @ApiProperty({ example: 'Compressor' })
  @IsString()
  itemName: string;

  @ApiProperty({ example: 'TL4G' })
  @IsString()
  model: string;

  @ApiProperty({ example: 'PCS' })
  @IsString()
  unit: string;

  @ApiPropertyOptional({ example: 'SECOF' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isSerialized?: boolean;

  @ApiProperty()
  @IsUUID()
  categoryId: string;
}

export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  itemName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSerialized?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}
