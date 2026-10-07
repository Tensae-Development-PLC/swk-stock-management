import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { ReportFilterDto } from './dto/report-filter.dto';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../common/constants/rbac';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('current-stock')
  @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  @ApiOperation({ summary: 'Current available stock' })
  currentStock(@Query() filters: ReportFilterDto) {
    return this.reportsService.currentStock(filters);
  }

  @Get('stock-in')
  @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  @ApiOperation({ summary: 'Stock in history' })
  stockIn(@Query() filters: ReportFilterDto) {
    return this.reportsService.stockIn(filters);
  }

  @Get('stock-out')
  @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  @ApiOperation({ summary: 'Stock out (sales and transfer dispatches)' })
  stockOut(@Query() filters: ReportFilterDto) {
    return this.reportsService.stockOut(filters);
  }

  @Get('sales')
  @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  @ApiOperation({ summary: 'Sales, revenue, and profit' })
  sales(@Query() filters: ReportFilterDto) {
    return this.reportsService.sales(filters);
  }

  @Get('transfers')
  @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  @ApiOperation({ summary: 'Regional transfers' })
  transfers(@Query() filters: ReportFilterDto) {
    return this.reportsService.transfers(filters);
  }

  @Get('pending-receipts')
  @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  @ApiOperation({ summary: 'Transfers awaiting receipt' })
  pendingReceipts(@Query() filters: ReportFilterDto) {
    return this.reportsService.transfers(filters, 'AWAITING_RECEIPT');
  }

  @Get('received-transfers')
  @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  @ApiOperation({ summary: 'Received transfers' })
  receivedTransfers(@Query() filters: ReportFilterDto) {
    return this.reportsService.transfers(filters, 'RECEIVED');
  }

  @Get('inventory-by-region')
  @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  @ApiOperation({ summary: 'Inventory grouped by region/location' })
  byRegion(@Query() filters: ReportFilterDto) {
    return this.reportsService.inventoryByRegion(filters);
  }

  @Get('inventory-by-product')
  @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  @ApiOperation({ summary: 'Inventory grouped by product' })
  byProduct(@Query() filters: ReportFilterDto) {
    return this.reportsService.inventoryByProduct(filters);
  }

  @Get('inventory-by-model')
  @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  @ApiOperation({ summary: 'Inventory grouped by model' })
  byModel(@Query() filters: ReportFilterDto) {
    return this.reportsService.inventoryByModel(filters);
  }

  @Get('inventory-by-serial')
  @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  @ApiOperation({ summary: 'Inventory by serial number' })
  bySerial(@Query() filters: ReportFilterDto) {
    return this.reportsService.inventoryBySerial(filters);
  }

  @Get('purchase-cost')
  @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  @ApiOperation({ summary: 'Purchase cost' })
  purchaseCost(@Query() filters: ReportFilterDto) {
    return this.reportsService.purchaseCost(filters);
  }

  @Get('sales-revenue')
  @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  @ApiOperation({ summary: 'Sales revenue and profit' })
  revenue(@Query() filters: ReportFilterDto) {
    return this.reportsService.sales(filters);
  }

  @Get('profit')
  @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  @ApiOperation({ summary: 'Profit (selling price minus purchase cost)' })
  profit(@Query() filters: ReportFilterDto) {
    return this.reportsService.sales(filters);
  }

  @Get('stock-movements')
  @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  @ApiOperation({ summary: 'Stock movement ledger' })
  movements(@Query() filters: ReportFilterDto) {
    return this.reportsService.movements(filters);
  }

  @Get('current-stock/export')
  @RequirePermissions(PERMISSIONS.REPORT_EXPORT)
  @ApiOperation({ summary: 'Export current stock as CSV or XLSX' })
  async exportCurrentStock(@Query() filters: ReportFilterDto, @Res() res: Response) {
    const data = await this.reportsService.currentStock(filters);
    const flat = data.rows.map((u) => {
      if (u.kind === 'OPENING_BALANCE') {
        return {
          kind: 'OPENING_BALANCE',
          serialNumber: '',
          itemName: u.product.itemName,
          model: u.product.model,
          status: 'OPENING',
          location: u.currentLocation.name,
          stockYear: u.stockYear,
          quantity: u.quantity,
          purchasePrice: '',
          purchaseDate: '',
        };
      }
      return {
        kind: 'SERIALIZED',
        serialNumber: u.serialNumber,
        itemName: u.product.itemName,
        model: u.product.model,
        status: u.status,
        location: u.currentLocation.name,
        stockYear: u.stockYear ?? '',
        quantity: 1,
        purchasePrice: u.purchasePrice.toString(),
        purchaseDate: u.purchaseDate.toISOString().slice(0, 10),
      };
    });
    if (filters.format === 'xlsx') {
      const file = await this.reportsService.toExcel('current-stock.xlsx', 'Current Stock', flat);
      res.setHeader('Content-Type', file.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
      return res.send(file.body);
    }
    const file = await this.reportsService.toCsv(
      'current-stock.csv',
      Object.keys(flat[0] ?? { serialNumber: '' }),
      flat,
    );
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    return res.send(file.body);
  }
}
