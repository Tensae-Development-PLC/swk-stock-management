import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class VerifyReceiptDto {
  @ApiProperty({
    example: 'TL4G002',
    description: 'Decoded barcode/QR serial number scanned by the receiver.',
  })
  @IsString()
  serialNumber: string;

  @ApiProperty({ example: 'Binyam', description: 'Receiver full name (required).' })
  @IsString()
  @MinLength(2)
  receiverName: string;

  @ApiProperty({ example: '0912345678', description: 'Receiver phone number (required).' })
  @IsString()
  @MinLength(7)
  receiverPhone: string;

  @ApiProperty({ example: 9.03, description: 'GPS latitude (required).' })
  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: 38.74, description: 'GPS longitude (required).' })
  @Type(() => Number)
  @IsNumber()
  longitude: number;

  @ApiProperty({ example: 12.5, description: 'GPS accuracy in meters.' })
  @Type(() => Number)
  @IsNumber()
  accuracy: number;
}
