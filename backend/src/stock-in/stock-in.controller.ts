import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import type { Request } from 'express';
import { StockInService } from './stock-in.service';
import { CreateStockInDto } from './dto/create-stock-in.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/rbac';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';

class StockInQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by FS / voucher number' })
  @IsOptional()
  @IsString()
  fsNumber?: string;

  @ApiPropertyOptional({ description: 'Filter by stock year' })
  @IsOptional()
  @IsString()
  stockYear?: string;
}

@ApiTags('stock-in')
@ApiBearerAuth()
@Controller('stock-in')
export class StockInController {
  constructor(private readonly stockInService: StockInService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.STOCK_IN_CREATE)
  @ApiOperation({
    summary: 'Receive serialized stock',
    description:
      'Atomic stock-in. Quantity must match the number of scanned serials. Duplicate or existing serials are rejected and the whole transaction rolls back.',
  })
  create(@Body() dto: CreateStockInDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.stockInService.create(dto, user, req.ip);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.STOCK_IN_VIEW)
  @ApiOperation({ summary: 'List stock-in batches' })
  findAll(@Query() query: StockInQueryDto) {
    return this.stockInService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.STOCK_IN_VIEW)
  @ApiOperation({ summary: 'Get stock-in batch' })
  findOne(@Param('id') id: string) {
    return this.stockInService.findOne(id);
  }
}
