import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateStockInDto } from './dto/create-stock-in.dto';
import { AuthUser } from '../auth/types/auth-user.type';
import { moneyString, unitCost } from '../common/utils/money';
import { findDuplicateSerials, normalizeSerial } from '../common/utils/serial';
import { PaginationQueryDto, paginationArgs, paginatedMeta } from '../common/dto/pagination-query.dto';

@Injectable()
export class StockInService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateStockInDto, actor: AuthUser, ip?: string) {
    const serials = dto.serials.map((s) => ({
      serialNumber: normalizeSerial(s.serialNumber),
      purchasePrice: s.purchasePrice,
    }));

    if (serials.length !== dto.quantity) {
      throw new UnprocessableEntityException(
        `Expected ${dto.quantity} serial number(s) but received ${serials.length}.`,
      );
    }
    const duplicates = findDuplicateSerials(serials.map((s) => s.serialNumber));
    if (duplicates.length) {
      throw new ConflictException(
        `Duplicate serial numbers in this transaction: ${duplicates.join(', ')}`,
      );
    }

    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found or inactive.');
    }
    if (!product.isSerialized) {
      throw new UnprocessableEntityException(
        'This product is not serialized. Use the non-serialized stock-in endpoint when available.',
      );
    }

    const location = await this.prisma.location.findUnique({ where: { id: dto.locationId } });
    if (!location || !location.isActive) {
      throw new NotFoundException('Location not found or inactive.');
    }

    const existing = await this.prisma.inventoryUnit.findMany({
      where: { serialNumber: { in: serials.map((s) => s.serialNumber) } },
      select: { serialNumber: true },
    });
    if (existing.length) {
      throw new ConflictException(
        `Serial number already exists: ${existing.map((e) => e.serialNumber).join(', ')}`,
      );
    }

    const computedUnitCost = unitCost(dto.totalCost, dto.quantity);

    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          const referenceNumber = await this.nextRef(tx, 'SI');
          const batch = await tx.stockInBatch.create({
            data: {
              referenceNumber,
              productId: product.id,
              locationId: location.id,
              quantity: dto.quantity,
              totalCost: moneyString(dto.totalCost),
              unitCost: moneyString(computedUnitCost),
              purchaseDate: new Date(dto.purchaseDate),
              stockYear: dto.stockYear,
              fsNumber: dto.fsNumber.trim(),
              remark: dto.remark,
              performedById: actor.id,
            },
          });

          for (const item of serials) {
            const price = item.purchasePrice ?? computedUnitCost;
            const unit = await tx.inventoryUnit.create({
              data: {
                productId: product.id,
                serialNumber: item.serialNumber,
                purchasePrice: moneyString(price),
                purchaseDate: new Date(dto.purchaseDate),
                stockYear: dto.stockYear,
                status: 'IN_STOCK',
                currentLocationId: location.id,
                remark: dto.remark,
              },
            });
            await tx.stockInItem.create({
              data: {
                stockInBatchId: batch.id,
                inventoryUnitId: unit.id,
                serialNumber: item.serialNumber,
                purchasePrice: moneyString(price),
              },
            });
            await tx.stockMovement.create({
              data: {
                inventoryUnitId: unit.id,
                productId: product.id,
                movementType: 'STOCK_IN',
                quantity: 1,
                destinationLocationId: location.id,
                purchasePrice: moneyString(price),
                referenceNumber,
                notes: dto.remark,
                performedById: actor.id,
                stockInBatchId: batch.id,
              },
            });
          }

          return batch;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      await this.audit.log({
        userId: actor.id,
        action: 'STOCK_IN',
        entity: 'StockInBatch',
        entityId: result.id,
        newValue: {
          referenceNumber: result.referenceNumber,
          productId: product.id,
          quantity: dto.quantity,
          serials: serials.map((s) => s.serialNumber),
        },
        ipAddress: ip,
      });

      return this.prisma.stockInBatch.findUnique({
        where: { id: result.id },
        include: {
          product: true,
          location: true,
          items: { include: { inventoryUnit: true } },
          performedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Serial number already exists.');
      }
      if (error instanceof BadRequestException || error instanceof ConflictException) {
        throw error;
      }
      throw error;
    }
  }

  async findAll(
    query: PaginationQueryDto & { fsNumber?: string; stockYear?: string },
  ) {
    const { skip, take, page, limit } = paginationArgs(query);
    const year = query.stockYear ? Number(query.stockYear) : undefined;
    const where: Prisma.StockInBatchWhereInput = {
      ...(query.fsNumber
        ? { fsNumber: { contains: query.fsNumber.trim(), mode: 'insensitive' } }
        : {}),
      ...(year && !Number.isNaN(year) ? { stockYear: year } : {}),
      ...(query.search
        ? {
            OR: [
              { referenceNumber: { contains: query.search, mode: 'insensitive' } },
              { fsNumber: { contains: query.search, mode: 'insensitive' } },
              { product: { itemName: { contains: query.search, mode: 'insensitive' } } },
              { items: { some: { serialNumber: { contains: query.search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.stockInBatch.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: query.sortOrder ?? 'desc' },
        include: { product: true, location: true, items: true },
      }),
      this.prisma.stockInBatch.count({ where }),
    ]);
    return { items, meta: paginatedMeta(total, page, limit) };
  }

  async findOne(id: string) {
    const batch = await this.prisma.stockInBatch.findUnique({
      where: { id },
      include: {
        product: true,
        location: true,
        items: { include: { inventoryUnit: true } },
        performedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    if (!batch) throw new NotFoundException('Stock in batch not found.');
    return batch;
  }

  private async nextRef(
    tx: Prisma.TransactionClient,
    prefix: string,
    year = new Date().getUTCFullYear(),
  ) {
    const sequence = await tx.documentSequence.upsert({
      where: { prefix_year: { prefix, year } },
      create: { prefix, year, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });
    return `${prefix}-${year}-${String(sequence.lastNumber).padStart(4, '0')}`;
  }
}
