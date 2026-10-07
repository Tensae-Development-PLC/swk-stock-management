import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class SaleItemDto {
  @ApiProperty({ example: 'TL4G001' })
  @IsString()
  serialNumber: string;

  @ApiProperty({ example: 65000, description: 'Actual selling price in ETB. Does not overwrite purchase cost.' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sellingPrice: number;
}

export class CreateSaleDto {
  @ApiProperty()
  @IsUUID()
  locationId: string;

  @ApiProperty({ example: '2026-08-30' })
  @IsDateString()
  saleDate: string;

  @ApiProperty({ example: 2026 })
  @Type(() => Number)
  @IsNumber()
  @Min(2000)
  stockYear: number;

  @ApiProperty({ example: 'FS-00123' })
  @IsString()
  fsNumber: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [SaleItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];
}
