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
} from 'class-validator';

export class CreateTransferDto {
  @ApiProperty()
  @IsUUID()
  sourceLocationId: string;

  @ApiProperty()
  @IsUUID()
  destinationLocationId: string;

  @ApiProperty()
  @IsUUID()
  reasonId: string;

  @ApiProperty({ example: 2026 })
  @Type(() => Number)
  @IsNumber()
  @Min(2000)
  stockYear: number;

  @ApiProperty({ example: 'FS-00123' })
  @IsString()
  fsNumber: string;

  @ApiPropertyOptional({
    description: 'Optional. Receiver enters their own name on the public receive page.',
  })
  @IsOptional()
  @IsString()
  receiverName?: string;

  @ApiPropertyOptional({
    description: 'Optional. Receiver enters their own phone on the public receive page.',
  })
  @IsOptional()
  @IsString()
  receiverPhone?: string;

  @ApiPropertyOptional({ example: '2026-08-30' })
  @IsOptional()
  @IsDateString()
  dispatchDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    type: [String],
    example: ['TL4G002'],
    description: 'Serial numbers of units to transfer. Decoded from barcode/QR.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  serialNumbers: string[];
}
