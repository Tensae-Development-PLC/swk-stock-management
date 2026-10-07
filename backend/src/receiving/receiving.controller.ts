import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { ReceivingService } from './receiving.service';
import { VerifyReceiptDto } from './dto/verify-receipt.dto';
import { SubmitMaintenanceDto } from './dto/submit-maintenance.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('receiving')
@Controller('receiving')
export class ReceivingController {
  constructor(private readonly receivingService: ReceivingService) {}

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get(':token')
  @ApiOperation({
    summary: 'Public receiving preview',
    description:
      'Shows limited transfer information for the holder of a secure token. Does not expose internal database IDs as part of the URL.',
  })
  preview(@Param('token') token: string) {
    return this.receivingService.preview(token);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get(':token/maintenance')
  @ApiOperation({ summary: 'Public maintenance preview (after receive)' })
  previewMaintenance(@Param('token') token: string) {
    return this.receivingService.previewMaintenance(token);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post(':token/verify')
  @ApiOperation({
    summary: 'Verify scanned serial against the assigned transfer',
    description:
      'Compares the scanned serial with the expected serial. Requires GPS coordinates.',
  })
  verify(
    @Param('token') token: string,
    @Body() dto: VerifyReceiptDto,
    @Req() req: Request,
  ) {
    return this.receivingService.verify(
      token,
      dto.serialNumber,
      req.ip,
      req.headers['user-agent'],
      dto.receiverName,
      dto.receiverPhone,
      dto.latitude,
      dto.longitude,
      dto.accuracy,
    );
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post(':token/maintenance')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype?.startsWith('image/')) {
          cb(new Error('Only image uploads are allowed.'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'serialNumber',
        'performedByName',
        'performedByPhone',
        'latitude',
        'longitude',
        'accuracy',
        'photo',
      ],
      properties: {
        serialNumber: { type: 'string' },
        performedByName: { type: 'string' },
        performedByPhone: { type: 'string' },
        latitude: { type: 'number' },
        longitude: { type: 'number' },
        accuracy: { type: 'number' },
        notes: { type: 'string' },
        photo: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Submit maintenance visit with photo + GPS' })
  submitMaintenance(
    @Param('token') token: string,
    @Body() dto: SubmitMaintenanceDto,
    @UploadedFile() photo: Express.Multer.File,
    @Req() req: Request,
  ) {
    return this.receivingService.submitMaintenance(
      token,
      {
        serialNumber: dto.serialNumber,
        performedByName: dto.performedByName,
        performedByPhone: dto.performedByPhone,
        latitude: Number(dto.latitude),
        longitude: Number(dto.longitude),
        accuracy: Number(dto.accuracy),
        notes: dto.notes,
      },
      photo,
      req.ip,
      req.headers['user-agent'],
    );
  }
}
