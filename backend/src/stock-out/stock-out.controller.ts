import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { StockOutService } from './stock-out.service';
import { CreateStockOutDto } from './dto/create-stock-out.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/rbac';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';

@ApiTags('stock-out')
@ApiBearerAuth()
@Controller('stock-out')
export class StockOutController {
  constructor(private readonly stockOutService: StockOutService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.STOCK_OUT_CREATE)
  @ApiOperation({
    summary: 'Stock out — direct sale or regional transfer',
    description: 'Select method DIRECT_SALE or REGIONAL_TRANSFER. Business rules are applied by the dedicated sale or transfer services.',
  })
  create(@Body() dto: CreateStockOutDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.stockOutService.create(dto, user, req.ip);
  }
}
