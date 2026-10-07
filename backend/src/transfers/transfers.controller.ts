import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { TransfersService } from './transfers.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/rbac';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import { TransferStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

class TransferQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TransferStatus })
  @IsOptional()
  @IsEnum(TransferStatus)
  status?: TransferStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  destinationLocationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fsNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stockYear?: string;
}

@ApiTags('transfers')
@ApiBearerAuth()
@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.TRANSFER_CREATE)
  @ApiOperation({
    summary: 'Create and dispatch a regional transfer',
    description:
      'Locks serialized units, writes TRANSFER_OUT movements, and returns receive + maintenance URLs.',
  })
  create(@Body() dto: CreateTransferDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.transfersService.create(dto, user, req.ip);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.TRANSFER_VIEW)
  @ApiOperation({ summary: 'List transfers' })
  findAll(@Query() query: TransferQueryDto) {
    return this.transfersService.findAll(query);
  }

  @Get('reasons')
  @RequirePermissions(PERMISSIONS.TRANSFER_VIEW)
  @ApiOperation({ summary: 'List transfer reasons' })
  reasons() {
    return this.transfersService.listReasons();
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.TRANSFER_VIEW)
  @ApiOperation({ summary: 'Get transfer including receipt status' })
  findOne(@Param('id') id: string) {
    return this.transfersService.findOne(id);
  }

  @Get(':id/field-events/:eventId/photo')
  @RequirePermissions(PERMISSIONS.TRANSFER_VIEW)
  @ApiOperation({ summary: 'Stream maintenance proof photo' })
  @Header('Cache-Control', 'private, max-age=3600')
  async fieldEventPhoto(
    @Param('id') id: string,
    @Param('eventId') eventId: string,
  ): Promise<StreamableFile> {
    return this.transfersService.streamFieldEventPhoto(id, eventId);
  }

  @Post(':id/receiving-link')
  @RequirePermissions(PERMISSIONS.TRANSFER_VIEW)
  @ApiOperation({
    summary: 'Get or refresh the public receiving link for a pending transfer',
  })
  receivingLink(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.transfersService.ensureReceivingLink(id, user, req.ip);
  }

  @Post(':id/maintenance-link')
  @RequirePermissions(PERMISSIONS.TRANSFER_VIEW)
  @ApiOperation({
    summary: 'Get or refresh the public maintenance link (after receive)',
  })
  maintenanceLink(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.transfersService.ensureMaintenanceLink(id, user, req.ip);
  }

  @Patch(':id/cancel')
  @RequirePermissions(PERMISSIONS.TRANSFER_CANCEL)
  @ApiOperation({ summary: 'Cancel a pending transfer and return units to source stock' })
  cancel(@Param('id') id: string, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.transfersService.cancel(id, user, req.ip);
  }
}
