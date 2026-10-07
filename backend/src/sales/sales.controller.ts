import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import type { Request } from 'express';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/rbac';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';

class SaleQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fsNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stockYear?: string;
}

@ApiTags('sales')
@ApiBearerAuth()
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.SALE_CREATE)
  @ApiOperation({
    summary: 'Direct sale',
    description:
      'Sells serialized units. Selling price is stored separately from purchase cost. Profit = sellingPrice - purchasePrice per unit.',
  })
  create(@Body() dto: CreateSaleDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.salesService.create(dto, user, req.ip);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.SALE_VIEW)
  @ApiOperation({ summary: 'List sales' })
  findAll(@Query() query: SaleQueryDto) {
    return this.salesService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SALE_VIEW)
  @ApiOperation({ summary: 'Get sale' })
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(id);
  }
}
