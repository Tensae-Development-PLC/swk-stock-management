import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { AuthUser } from '../auth/types/auth-user.type';
import { moneyString, profit } from '../common/utils/money';
import { findDuplicateSerials, normalizeSerial } from '../common/utils/serial';
import { PaginationQueryDto, paginationArgs, paginatedMeta } from '../common/dto/pagination-query.dto';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateSaleDto, actor: AuthUser, ip?: string) {
    const serials = dto.items.map((i) => normalizeSerial(i.serialNumber));
    const duplicates = findDuplicateSerials(serials);
    if (duplicates.length) {
      throw new ConflictException(`Duplicate serial numbers in this sale: ${duplicates.join(', ')}`);
    }

    const location = await this.prisma.location.findUnique({ where: { id: dto.locationId } });
    if (!location || !location.isActive) {
      throw new NotFoundException('Location not found or inactive.');
    }

    const sale = await this.prisma.$transaction(
      async (tx) => {
        const referenceNumber = await this.nextRef(tx, 'SL');
        const saleRow = await tx.sale.create({
          data: {
            referenceNumber,
            locationId: location.id,
            saleDate: new Date(dto.saleDate),
            stockYear: dto.stockYear,
            fsNumber: dto.fsNumber.trim(),
            notes: dto.notes,
            performedById: actor.id,
          },
        });

        for (const item of dto.items) {
          const serial = normalizeSerial(item.serialNumber);
          const unit = await tx.inventoryUnit.findUnique({
            where: { serialNumber: serial },
          });
          if (!unit) {
            throw new NotFoundException(`Inventory unit not found for serial ${serial}.`);
          }
          if (unit.status === 'SOLD') {
            throw new ConflictException(`Inventory unit ${serial} is not available for sale.`);
          }
          if (unit.status === 'DISPATCHED' || unit.status === 'AWAITING_RECEIPT') {
            throw new ConflictException(`Inventory unit ${serial} has already been dispatched.`);
          }
          if (unit.status !== 'IN_STOCK' && unit.status !== 'RECEIVED') {
            throw new UnprocessableEntityException(
              `Inventory unit ${serial} is not available for sale.`,
            );
          }
          if (unit.currentLocationId !== location.id) {
            throw new UnprocessableEntityException(
              `Inventory unit ${serial} is not at the selected sale location.`,
            );
          }

          const locked = await tx.inventoryUnit.updateMany({
            where: {
              id: unit.id,
              status: { in: ['IN_STOCK', 'RECEIVED'] },
              version: unit.version,
            },
            data: { status: 'SOLD', version: { increment: 1 } },
          });
          if (locked.count !== 1) {
            throw new ConflictException(
              `Inventory unit ${serial} is not available for sale.`,
            );
          }

          const lineProfit = profit(item.sellingPrice, unit.purchasePrice);
          await tx.saleItem.create({
            data: {
              saleId: saleRow.id,
              inventoryUnitId: unit.id,
              productId: unit.productId,
              serialNumber: serial,
              purchasePrice: unit.purchasePrice,
              sellingPrice: moneyString(item.sellingPrice),
              profit: moneyString(lineProfit),
            },
          });
          await tx.stockMovement.create({
            data: {
              inventoryUnitId: unit.id,
              productId: unit.productId,
              movementType: 'SALE',
              quantity: 1,
              sourceLocationId: location.id,
              purchasePrice: unit.purchasePrice,
              sellingPrice: moneyString(item.sellingPrice),
              referenceNumber,
              notes: dto.notes,
              performedById: actor.id,
              saleId: saleRow.id,
            },
          });
        }

        return saleRow;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.audit.log({
      userId: actor.id,
      action: 'SALE',
      entity: 'Sale',
      entityId: sale.id,
      newValue: { referenceNumber: sale.referenceNumber, serials },
      ipAddress: ip,
    });

    return this.findOne(sale.id);
  }

  async findAll(query: PaginationQueryDto & { fsNumber?: string; stockYear?: string }) {
    const { skip, take, page, limit } = paginationArgs(query);
    const year = query.stockYear ? Number(query.stockYear) : undefined;
    const where: Prisma.SaleWhereInput = {
      ...(query.fsNumber
        ? { fsNumber: { contains: query.fsNumber.trim(), mode: 'insensitive' } }
        : {}),
      ...(year && !Number.isNaN(year) ? { stockYear: year } : {}),
      ...(query.search
        ? {
            OR: [
              { referenceNumber: { contains: query.search, mode: 'insensitive' } },
              { fsNumber: { contains: query.search, mode: 'insensitive' } },
              { items: { some: { serialNumber: { contains: query.search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: query.sortOrder ?? 'desc' },
        include: {
          location: true,
          items: { include: { product: true } },
          performedBy: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.sale.count({ where }),
    ]);
    return { items, meta: paginatedMeta(total, page, limit) };
  }

  async findOne(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        location: true,
        items: { include: { product: true, inventoryUnit: true } },
        performedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    if (!sale) throw new NotFoundException('Sale not found.');
    return sale;
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
