import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { InventoryStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { InventoryService } from './inventory.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/rbac';

class InventoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: InventoryStatus })
  @IsOptional()
  @IsEnum(InventoryStatus)
  status?: InventoryStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialNumber?: string;
}

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.INVENTORY_VIEW)
  @ApiOperation({
    summary: 'List serialized inventory units',
    description: 'Each row is one physical unit identified by serial number.',
  })
  findAll(@Query() query: InventoryQueryDto) {
    return this.inventoryService.findAll(query);
  }

  @Get('balances')
  @RequirePermissions(PERMISSIONS.INVENTORY_VIEW)
  @ApiOperation({
    summary: 'List opening / non-serialized balances',
    description: 'Quantities imported from Excel (no serial numbers).',
  })
  findBalances(
    @Query()
    query: PaginationQueryDto & { locationId?: string; productId?: string; stockYear?: string },
  ) {
    return this.inventoryService.findBalances(query);
  }

  @Get('serial/:serialNumber')
  @RequirePermissions(PERMISSIONS.INVENTORY_VIEW)
  @ApiOperation({ summary: 'Look up inventory unit by serial number' })
  findBySerial(@Param('serialNumber') serialNumber: string) {
    return this.inventoryService.findBySerial(serialNumber);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.INVENTORY_VIEW)
  @ApiOperation({ summary: 'Get inventory unit by id' })
  findOne(@Param('id') id: string) {
    return this.inventoryService.findOne(id);
  }
}
