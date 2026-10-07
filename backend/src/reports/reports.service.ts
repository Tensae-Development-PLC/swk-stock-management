import { Injectable } from '@nestjs/common';
import { InventoryStatus, MovementType, Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { ReportFilterDto } from './dto/report-filter.dto';
import { moneyString, sumMoney } from '../common/utils/money';
import { AVAILABLE_INVENTORY_STATUSES } from '../common/constants/rbac';
import { normalizeSerial } from '../common/utils/serial';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async currentStock(filters: ReportFilterDto) {
    const units = await this.prisma.inventoryUnit.findMany({
      where: this.unitWhere(filters, {
        status: filters.status ?? { in: [...AVAILABLE_INVENTORY_STATUSES] as InventoryStatus[] },
        ...(filters.year ? { stockYear: filters.year } : {}),
      }),
      include: { product: { include: { category: true } }, currentLocation: true },
      orderBy: { serialNumber: 'asc' },
    });
    const balances = await this.prisma.inventoryBalance.findMany({
      where: {
        ...(filters.productId ? { productId: filters.productId } : {}),
        ...(filters.locationId ? { locationId: filters.locationId } : {}),
        ...(filters.year ? { stockYear: filters.year } : {}),
        quantity: { gt: 0 },
      },
      include: { product: { include: { category: true } }, location: true },
    });
    return {
      rows: [
        ...units.map((u) => ({
          ...u,
          stockYear: u.stockYear,
          kind: 'SERIALIZED' as const,
        })),
        ...balances.map((b) => ({
          id: b.id,
          product: b.product,
          currentLocation: b.location,
          stockYear: b.stockYear,
          quantity: b.quantity,
          serialNumber: null,
          kind: 'OPENING_BALANCE' as const,
        })),
      ],
      totals: {
        quantity: units.length + balances.reduce((n, b) => n + b.quantity, 0),
        stockValue: moneyString(sumMoney(units.map((u) => u.purchasePrice))),
        currency: 'ETB',
      },
    };
  }

  async stockIn(filters: ReportFilterDto) {
    const rows = await this.prisma.stockInBatch.findMany({
      where: this.dateWhere(filters, 'createdAt', {
        ...(filters.productId ? { productId: filters.productId } : {}),
        ...(filters.locationId ? { locationId: filters.locationId } : {}),
        ...(filters.userId ? { performedById: filters.userId } : {}),
        ...(filters.year ? { stockYear: filters.year } : {}),
        ...(filters.fsNumber
          ? { fsNumber: { contains: filters.fsNumber, mode: 'insensitive' } }
          : {}),
      }),
      include: { product: true, location: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
    return { rows, totals: { batches: rows.length, units: rows.reduce((n, r) => n + r.quantity, 0) } };
  }

  async stockOut(filters: ReportFilterDto) {
    return this.movements(filters, ['SALE', 'TRANSFER_OUT']);
  }

  async sales(filters: ReportFilterDto) {
    const rows = await this.prisma.saleItem.findMany({
      where: {
        ...(filters.productId ? { productId: filters.productId } : {}),
        ...(filters.serialNumber
          ? { serialNumber: { equals: normalizeSerial(filters.serialNumber), mode: 'insensitive' } }
          : {}),
        sale: {
          ...(filters.from || filters.to
            ? {
                saleDate: {
                  ...(filters.from ? { gte: new Date(filters.from) } : {}),
                  ...(filters.to ? { lte: new Date(filters.to) } : {}),
                },
              }
            : {}),
          ...(filters.locationId ? { locationId: filters.locationId } : {}),
          ...(filters.userId ? { performedById: filters.userId } : {}),
          ...(filters.year ? { stockYear: filters.year } : {}),
          ...(filters.fsNumber
            ? { fsNumber: { contains: filters.fsNumber, mode: 'insensitive' } }
            : {}),
        },
      },
      include: { sale: true, product: true },
      orderBy: { createdAt: 'desc' },
    });
    return {
      rows,
      totals: {
        units: rows.length,
        revenue: moneyString(sumMoney(rows.map((r) => r.sellingPrice))),
        purchaseCost: moneyString(sumMoney(rows.map((r) => r.purchasePrice))),
        profit: moneyString(sumMoney(rows.map((r) => r.profit))),
        currency: 'ETB',
      },
    };
  }

  async transfers(filters: ReportFilterDto, status?: 'AWAITING_RECEIPT' | 'RECEIVED') {
    const rows = await this.prisma.transfer.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(filters.locationId
          ? {
              OR: [
                { sourceLocationId: filters.locationId },
                { destinationLocationId: filters.locationId },
              ],
            }
          : {}),
        ...(filters.year ? { stockYear: filters.year } : {}),
        ...(filters.fsNumber
          ? { fsNumber: { contains: filters.fsNumber, mode: 'insensitive' } }
          : {}),
        ...this.createdAtRange(filters),
      },
      include: {
        sourceLocation: true,
        destinationLocation: true,
        reason: true,
        items: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { rows, totals: { transfers: rows.length } };
  }

  async inventoryByRegion(filters: ReportFilterDto) {
    const grouped = await this.prisma.inventoryUnit.groupBy({
      by: ['currentLocationId', 'status'],
      where: this.unitWhere(filters),
      _count: { _all: true },
    });
    const locations = await this.prisma.location.findMany();
    const map = new Map(locations.map((l) => [l.id, l]));
    return {
      rows: grouped.map((g) => ({
        location: map.get(g.currentLocationId),
        status: g.status,
        quantity: g._count._all,
      })),
    };
  }

  async inventoryByProduct(filters: ReportFilterDto) {
    const grouped = await this.prisma.inventoryUnit.groupBy({
      by: ['productId', 'status'],
      where: this.unitWhere(filters),
      _count: { _all: true },
    });
    const products = await this.prisma.product.findMany({ include: { category: true } });
    const map = new Map(products.map((p) => [p.id, p]));
    return {
      rows: grouped.map((g) => ({
        product: map.get(g.productId),
        status: g.status,
        quantity: g._count._all,
      })),
    };
  }

  async inventoryByModel(filters: ReportFilterDto) {
    const units = await this.prisma.inventoryUnit.findMany({
      where: this.unitWhere(filters),
      include: { product: true },
    });
    const map = new Map<string, { model: string; itemName: string; quantity: number }>();
    for (const unit of units) {
      const key = `${unit.product.itemName}|${unit.product.model}`;
      const current = map.get(key) ?? {
        model: unit.product.model,
        itemName: unit.product.itemName,
        quantity: 0,
      };
      current.quantity += 1;
      map.set(key, current);
    }
    return { rows: [...map.values()] };
  }

  async inventoryBySerial(filters: ReportFilterDto) {
    return this.currentStock({ ...filters, status: filters.status });
  }

  async purchaseCost(filters: ReportFilterDto) {
    const batches = await this.stockIn(filters);
    const total = sumMoney(batches.rows.map((b) => b.totalCost));
    return { rows: batches.rows, totals: { purchaseCost: moneyString(total), currency: 'ETB' } };
  }

  async movements(filters: ReportFilterDto, types?: MovementType[]) {
    const rows = await this.prisma.stockMovement.findMany({
      where: {
        ...(types ? { movementType: { in: types } } : {}),
        ...(filters.movementType ? { movementType: filters.movementType } : {}),
        ...(filters.productId ? { productId: filters.productId } : {}),
        ...(filters.locationId
          ? {
              OR: [
                { sourceLocationId: filters.locationId },
                { destinationLocationId: filters.locationId },
              ],
            }
          : {}),
        ...(filters.userId ? { performedById: filters.userId } : {}),
        ...(filters.serialNumber
          ? {
              inventoryUnit: {
                serialNumber: { equals: normalizeSerial(filters.serialNumber), mode: 'insensitive' },
              },
            }
          : {}),
        ...this.createdAtRange(filters),
      },
      include: {
        product: true,
        inventoryUnit: true,
        sourceLocation: true,
        destinationLocation: true,
        performedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    return { rows, totals: { movements: rows.length } };
  }

  async toCsv(filename: string, headers: string[], rows: Record<string, unknown>[]) {
    const headerLine = headers.join(',');
    const body = rows
      .map((row) =>
        headers
          .map((h) => {
            const value = row[h] ?? '';
            const text = String(value).replace(/"/g, '""');
            return `"${text}"`;
          })
          .join(','),
      )
      .join('\n');
    return { filename, contentType: 'text/csv; charset=utf-8', body: `${headerLine}\n${body}` };
  }

  async toExcel(filename: string, sheetName: string, rows: Record<string, unknown>[]) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName);
    if (rows.length) {
      sheet.columns = Object.keys(rows[0]).map((key) => ({ header: key, key, width: 22 }));
      sheet.addRows(rows);
    }
    const buffer = await workbook.xlsx.writeBuffer();
    return {
      filename,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: Buffer.from(buffer),
    };
  }

  private unitWhere(
    filters: ReportFilterDto,
    extra: Prisma.InventoryUnitWhereInput = {},
  ): Prisma.InventoryUnitWhereInput {
    return {
      ...extra,
      ...(filters.productId ? { productId: filters.productId } : {}),
      ...(filters.locationId ? { currentLocationId: filters.locationId } : {}),
      ...(filters.serialNumber
        ? { serialNumber: { equals: normalizeSerial(filters.serialNumber), mode: 'insensitive' } }
        : {}),
      ...(filters.model || filters.categoryId
        ? {
            product: {
              ...(filters.model ? { model: { equals: filters.model, mode: 'insensitive' } } : {}),
              ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
            },
          }
        : {}),
    };
  }

  private dateWhere(
    filters: ReportFilterDto,
    field: 'createdAt',
    extra: Prisma.StockInBatchWhereInput = {},
  ): Prisma.StockInBatchWhereInput {
    return {
      ...extra,
      ...this.createdAtRange(filters, field),
    };
  }

  private createdAtRange(filters: ReportFilterDto, field: 'createdAt' = 'createdAt') {
    if (!filters.from && !filters.to) return {};
    return {
      [field]: {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      },
    };
  }
}
