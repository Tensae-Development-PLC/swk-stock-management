import { Injectable } from '@nestjs/common';
import { InventoryStatus, MovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { moneyString, sumMoney } from '../common/utils/money';
import { AVAILABLE_INVENTORY_STATUSES, OWNED_INVENTORY_STATUSES } from '../common/constants/rbac';

type Period = '7d' | '30d' | '90d' | '1y';

function periodStart(period: Period) {
  const now = new Date();
  const start = new Date(now);
  if (period === '7d') start.setDate(now.getDate() - 7);
  else if (period === '30d') start.setDate(now.getDate() - 30);
  else if (period === '90d') start.setDate(now.getDate() - 90);
  else start.setFullYear(now.getFullYear() - 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(period: Period = '30d') {
    const from = periodStart(period);

    const [
      totalProducts,
      totalSerializedUnits,
      availableStock,
      soldUnits,
      dispatchedUnits,
      pendingReceipts,
      receivedTransfers,
      maintenanceUnits,
      failedVerifications,
      recentMovements,
      stockByRegion,
      availableValueRows,
      salesAgg,
      categoryUnits,
      topProductUnits,
      periodMovements,
      recentUnits,
    ] = await Promise.all([
      this.prisma.product.count({ where: { isActive: true } }),
      this.prisma.inventoryUnit.count(),
      this.prisma.inventoryUnit.count({
        where: { status: { in: [...AVAILABLE_INVENTORY_STATUSES] as InventoryStatus[] } },
      }),
      this.prisma.inventoryUnit.count({ where: { status: 'SOLD' } }),
      this.prisma.inventoryUnit.count({
        where: { status: { in: ['DISPATCHED', 'AWAITING_RECEIPT'] } },
      }),
      this.prisma.transfer.count({ where: { status: 'AWAITING_RECEIPT' } }),
      this.prisma.transfer.count({ where: { status: 'RECEIVED' } }),
      this.prisma.inventoryUnit.count({ where: { status: 'IN_MAINTENANCE' } }),
      this.prisma.verificationLog.count({ where: { result: 'MISMATCH' } }),
      this.prisma.stockMovement.findMany({
        take: 12,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { itemName: true, model: true } },
          inventoryUnit: { select: { serialNumber: true } },
          sourceLocation: { select: { name: true, code: true } },
          destinationLocation: { select: { name: true, code: true } },
          performedBy: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.inventoryUnit.groupBy({
        by: ['currentLocationId', 'status'],
        _count: { _all: true },
      }),
      this.prisma.inventoryUnit.findMany({
        where: { status: { in: [...OWNED_INVENTORY_STATUSES] as InventoryStatus[] } },
        select: {
          purchasePrice: true,
          currentLocationId: true,
          status: true,
          productId: true,
          product: { select: { categoryId: true, itemName: true, model: true, category: { select: { id: true, name: true, code: true } } } },
        },
      }),
      this.prisma.saleItem.aggregate({
        _sum: { sellingPrice: true, profit: true, purchasePrice: true },
      }),
      this.prisma.inventoryUnit.findMany({
        where: { status: { in: [...AVAILABLE_INVENTORY_STATUSES] as InventoryStatus[] } },
        select: {
          purchasePrice: true,
          product: { select: { categoryId: true, category: { select: { id: true, name: true, code: true } } } },
        },
      }),
      this.prisma.inventoryUnit.groupBy({
        by: ['productId'],
        where: { status: { in: [...AVAILABLE_INVENTORY_STATUSES] as InventoryStatus[] } },
        _count: { _all: true },
      }),
      this.prisma.stockMovement.findMany({
        where: {
          createdAt: { gte: from },
          movementType: { in: ['STOCK_IN', 'SALE', 'TRANSFER_OUT'] as MovementType[] },
        },
        select: { movementType: true, createdAt: true, quantity: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.inventoryUnit.findMany({
        take: 8,
        orderBy: { updatedAt: 'desc' },
        include: {
          product: { select: { itemName: true, model: true, bcNumber: true } },
          currentLocation: { select: { name: true, code: true } },
          movements: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { movementType: true, createdAt: true },
          },
        },
      }),
    ]);

    const locations = await this.prisma.location.findMany({
      select: { id: true, name: true, code: true },
    });
    const locationName = new Map(locations.map((l) => [l.id, l]));

    const stockValue = sumMoney(availableValueRows.map((r) => r.purchasePrice));
    const availableValue = sumMoney(
      availableValueRows
        .filter((r) => (AVAILABLE_INVENTORY_STATUSES as readonly string[]).includes(r.status))
        .map((r) => r.purchasePrice),
    );

    const byRegionMap = new Map<
      string,
      {
        locationId: string;
        name: string;
        code: string;
        available: number;
        dispatched: number;
        total: number;
        stockValue: string;
      }
    >();
    for (const row of stockByRegion) {
      const loc = locationName.get(row.currentLocationId);
      if (!loc) continue;
      const current = byRegionMap.get(loc.id) ?? {
        locationId: loc.id,
        name: loc.name,
        code: loc.code,
        available: 0,
        dispatched: 0,
        total: 0,
        stockValue: '0.00',
      };
      current.total += row._count._all;
      if ((AVAILABLE_INVENTORY_STATUSES as readonly string[]).includes(row.status)) {
        current.available += row._count._all;
      }
      if (row.status === 'DISPATCHED' || row.status === 'AWAITING_RECEIPT') {
        current.dispatched += row._count._all;
      }
      byRegionMap.set(loc.id, current);
    }
    for (const unit of availableValueRows) {
      if (!(AVAILABLE_INVENTORY_STATUSES as readonly string[]).includes(unit.status)) continue;
      const current = byRegionMap.get(unit.currentLocationId);
      if (!current) continue;
      current.stockValue = moneyString(sumMoney([current.stockValue, unit.purchasePrice]));
    }

    const byCategoryMap = new Map<
      string,
      { categoryId: string; name: string; code: string; units: number; stockValue: string }
    >();
    for (const unit of categoryUnits) {
      const cat = unit.product.category;
      if (!cat) continue;
      const current = byCategoryMap.get(cat.id) ?? {
        categoryId: cat.id,
        name: cat.name,
        code: cat.code,
        units: 0,
        stockValue: '0.00',
      };
      current.units += 1;
      current.stockValue = moneyString(sumMoney([current.stockValue, unit.purchasePrice]));
      byCategoryMap.set(cat.id, current);
    }

    const productIds = topProductUnits.map((p) => p.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, itemName: true, model: true, bcNumber: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));
    const valueByProduct = new Map<string, ReturnType<typeof sumMoney>>();
    for (const unit of availableValueRows) {
      if (!(AVAILABLE_INVENTORY_STATUSES as readonly string[]).includes(unit.status)) continue;
      valueByProduct.set(
        unit.productId,
        sumMoney([valueByProduct.get(unit.productId) ?? 0, unit.purchasePrice]),
      );
    }
    const topProducts = topProductUnits
      .map((row) => {
        const product = productMap.get(row.productId);
        return {
          productId: row.productId,
          itemName: product?.itemName ?? 'Unknown',
          model: product?.model ?? '',
          bcNumber: product?.bcNumber ?? '',
          units: row._count._all,
          stockValue: moneyString(valueByProduct.get(row.productId) ?? 0),
        };
      })
      .sort((a, b) => b.units - a.units)
      .slice(0, 6);

    const seriesMap = new Map<string, { date: string; stockIn: number; stockOut: number }>();
    const cursor = new Date(from);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    while (cursor <= today) {
      const key = dayKey(cursor);
      seriesMap.set(key, { date: key, stockIn: 0, stockOut: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    for (const movement of periodMovements) {
      const key = dayKey(movement.createdAt);
      const bucket = seriesMap.get(key);
      if (!bucket) continue;
      if (movement.movementType === 'STOCK_IN') bucket.stockIn += movement.quantity;
      if (movement.movementType === 'SALE' || movement.movementType === 'TRANSFER_OUT') {
        bucket.stockOut += movement.quantity;
      }
    }

    return {
      period,
      totalProducts,
      totalSerializedUnits,
      availableStock,
      soldUnits,
      dispatchedUnits,
      pendingReceipts,
      receivedTransfers,
      maintenanceUnits,
      failedVerifications,
      stockValue: moneyString(stockValue),
      availableStockValue: moneyString(availableValue),
      salesRevenue: moneyString(salesAgg._sum.sellingPrice ?? 0),
      salesPurchaseCost: moneyString(salesAgg._sum.purchasePrice ?? 0),
      estimatedProfit: moneyString(salesAgg._sum.profit ?? 0),
      stockByRegion: [...byRegionMap.values()].sort((a, b) => b.available - a.available),
      stockByCategory: [...byCategoryMap.values()].sort((a, b) => b.units - a.units),
      topProducts,
      movementSeries: [...seriesMap.values()],
      recentStockMovements: recentMovements,
      recentInventory: recentUnits.map((u) => ({
        id: u.id,
        serialNumber: u.serialNumber,
        status: u.status,
        purchasePrice: moneyString(u.purchasePrice),
        product: u.product,
        currentLocation: u.currentLocation,
        lastMovement: u.movements[0]
          ? { movementType: u.movements[0].movementType, createdAt: u.movements[0].createdAt }
          : null,
      })),
      currency: 'ETB',
    };
  }
}
