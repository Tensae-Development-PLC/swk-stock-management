import { Injectable, NotFoundException } from '@nestjs/common';
import { InventoryStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto, paginationArgs, paginatedMeta } from '../common/dto/pagination-query.dto';
import { normalizeSerial } from '../common/utils/serial';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: PaginationQueryDto & {
      status?: InventoryStatus;
      locationId?: string;
      productId?: string;
      serialNumber?: string;
    },
  ) {
    const { skip, take, page, limit } = paginationArgs(query);
    const where: Prisma.InventoryUnitWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.locationId ? { currentLocationId: query.locationId } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.serialNumber
        ? { serialNumber: { equals: normalizeSerial(query.serialNumber), mode: 'insensitive' } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { serialNumber: { contains: query.search, mode: 'insensitive' } },
              { product: { itemName: { contains: query.search, mode: 'insensitive' } } },
              { product: { model: { contains: query.search, mode: 'insensitive' } } },
              { product: { bcNumber: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.inventoryUnit.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: query.sortOrder ?? 'desc' },
        include: {
          product: { include: { category: true } },
          currentLocation: true,
        },
      }),
      this.prisma.inventoryUnit.count({ where }),
    ]);
    return { items, meta: paginatedMeta(total, page, limit) };
  }

  async findBalances(
    query: PaginationQueryDto & { locationId?: string; productId?: string; stockYear?: string },
  ) {
    const { skip, take, page, limit } = paginationArgs(query);
    const year = query.stockYear ? Number(query.stockYear) : undefined;
    const where: Prisma.InventoryBalanceWhereInput = {
      quantity: { gt: 0 },
      ...(query.locationId ? { locationId: query.locationId } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(year && !Number.isNaN(year) ? { stockYear: year } : {}),
      ...(query.search
        ? {
            OR: [
              { product: { itemName: { contains: query.search, mode: 'insensitive' } } },
              { product: { model: { contains: query.search, mode: 'insensitive' } } },
              { product: { bcNumber: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.inventoryBalance.findMany({
        where,
        skip,
        take,
        orderBy: [{ stockYear: 'desc' }, { quantity: 'desc' }],
        include: {
          product: { include: { category: true } },
          location: true,
        },
      }),
      this.prisma.inventoryBalance.count({ where }),
    ]);
    return { items, meta: paginatedMeta(total, page, limit) };
  }

  async findBySerial(serialNumber: string) {
    const unit = await this.prisma.inventoryUnit.findUnique({
      where: { serialNumber: normalizeSerial(serialNumber) },
      include: {
        product: { include: { category: true } },
        currentLocation: true,
        movements: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!unit) throw new NotFoundException('Inventory unit not found for this serial number.');
    return unit;
  }

  async findOne(id: string) {
    const unit = await this.prisma.inventoryUnit.findUnique({
      where: { id },
      include: {
        product: { include: { category: true } },
        currentLocation: true,
        movements: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!unit) throw new NotFoundException('Inventory unit not found.');
    return unit;
  }
}
