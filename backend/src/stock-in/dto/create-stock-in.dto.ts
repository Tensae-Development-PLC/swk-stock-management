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

export class StockInSerialDto {
  @ApiProperty({ example: 'TL4G001', description: 'Decoded barcode/QR serial number' })
  @IsString()
  serialNumber: string;

  @ApiPropertyOptional({
    description: 'Optional per-unit purchase cost. Defaults to totalCost / quantity.',
    example: 50000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  purchasePrice?: number;
}

export class CreateStockInDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty()
  @IsUUID()
  locationId: string;

  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({
    example: 150000,
    description: 'TOTAL purchase cost in ETB for this batch.',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalCost: number;

  @ApiProperty({ example: '2026-08-28' })
  @IsDateString()
  purchaseDate: string;

  @ApiProperty({ example: 2026, description: 'Stock year for reporting and filters' })
  @Type(() => Number)
  @IsNumber()
  @Min(2000)
  stockYear: number;

  @ApiProperty({ example: 'FS-00123', description: 'Fiscal / invoice / voucher number' })
  @IsString()
  fsNumber: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiProperty({
    type: [StockInSerialDto],
    description:
      'One entry per physical unit. Length must equal quantity for serialized products. Send the decoded barcode/QR value as serialNumber.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StockInSerialDto)
  serials: StockInSerialDto[];
}
