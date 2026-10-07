import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export enum StockOutMethod {
  DIRECT_SALE = 'DIRECT_SALE',
  REGIONAL_TRANSFER = 'REGIONAL_TRANSFER',
}

export class StockOutItemDto {
  @ApiProperty({ example: 'TL4G001' })
  @IsString()
  serialNumber: string;

  @ApiPropertyOptional({
    example: 65000,
    description: 'Required when method is DIRECT_SALE.',
  })
  @ValidateIf((o) => o.sellingPrice !== undefined)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sellingPrice?: number;
}

export class CreateStockOutDto {
  @ApiProperty({ enum: StockOutMethod })
  @IsEnum(StockOutMethod)
  method: StockOutMethod;

  @ApiProperty({ type: [StockOutItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StockOutItemDto)
  items: StockOutItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  saleDate?: string;

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
  @IsUUID()
  sourceLocationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  destinationLocationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  reasonId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receiverName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receiverPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dispatchDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
