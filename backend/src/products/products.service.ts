import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { PaginationQueryDto, paginationArgs, paginatedMeta } from '../common/dto/pagination-query.dto';
import { AuthUser } from '../auth/types/auth-user.type';
import { AVAILABLE_INVENTORY_STATUSES } from '../common/constants/rbac';

const productInclude = {
  category: true,
  _count: { select: { inventoryUnits: true } },
} as const;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateProductDto, actor: AuthUser, ip?: string) {
    const bcNumber = dto.bcNumber?.trim() || (await this.nextBcNumber());
    const existing = await this.prisma.product.findUnique({ where: { bcNumber } });
    if (existing) {
      throw new ConflictException('BC number already exists.');
    }
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) throw new NotFoundException('Category not found.');

    const product = await this.prisma.product.create({
      data: {
        bcNumber,
        itemName: dto.itemName.trim(),
        model: dto.model.trim(),
        unit: dto.unit.trim(),
        brand: dto.brand?.trim(),
        description: dto.description,
        isSerialized: dto.isSerialized ?? true,
        categoryId: dto.categoryId,
      },
      include: productInclude,
    });

    await this.audit.log({
      userId: actor.id,
      action: 'PRODUCT_CREATE',
      entity: 'Product',
      entityId: product.id,
      newValue: { bcNumber: product.bcNumber, itemName: product.itemName, model: product.model },
      ipAddress: ip,
    });
    return this.withAvailability(product);
  }

  async findAll(query: PaginationQueryDto & { categoryId?: string; isSerialized?: string }) {
    const { skip, take, page, limit } = paginationArgs(query);
    const where: Prisma.ProductWhereInput = {
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.search
        ? {
            OR: [
              { bcNumber: { contains: query.search, mode: 'insensitive' } },
              { itemName: { contains: query.search, mode: 'insensitive' } },
              { model: { contains: query.search, mode: 'insensitive' } },
              { brand: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const sortBy = query.sortBy === 'itemName' ? 'itemName' : 'createdAt';
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: query.sortOrder ?? (sortBy === 'itemName' ? 'asc' : 'desc') },
        include: productInclude,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items: await this.withAvailabilityMany(items), meta: paginatedMeta(total, page, limit) };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: productInclude });
    if (!product) throw new NotFoundException('Product not found.');
    return this.withAvailability(product);
  }

  async update(id: string, dto: UpdateProductDto, actor: AuthUser, ip?: string) {
    const existing = await this.findOne(id);
    const product = await this.prisma.product.update({
      where: { id },
      data: dto,
      include: productInclude,
    });
    await this.audit.log({
      userId: actor.id,
      action: 'PRODUCT_UPDATE',
      entity: 'Product',
      entityId: id,
      oldValue: { itemName: existing.itemName, model: existing.model, isActive: existing.isActive },
      newValue: { itemName: product.itemName, model: product.model, isActive: product.isActive },
      ipAddress: ip,
    });
    return this.withAvailability(product);
  }

  private async nextBcNumber() {
    const latest = await this.prisma.product.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { bcNumber: true },
    });
    const match = latest?.bcNumber.match(/^(\d+)$/);
    const next = match ? Number(match[1]) + 1 : (await this.prisma.product.count()) + 1;
    return String(next).padStart(3, '0');
  }

  private async withAvailabilityMany<
    T extends { id: string; _count: { inventoryUnits: number } },
  >(items: T[]) {
    if (!items.length) return [];
    const ids = items.map((i) => i.id);
    const [available, balances] = await Promise.all([
      this.prisma.inventoryUnit.groupBy({
        by: ['productId'],
        where: {
          productId: { in: ids },
          status: { in: [...AVAILABLE_INVENTORY_STATUSES] as InventoryStatus[] },
        },
        _count: { _all: true },
      }),
      this.prisma.inventoryBalance.groupBy({
        by: ['productId'],
        where: { productId: { in: ids } },
        _sum: { quantity: true },
      }),
    ]);
    const serialMap = new Map(available.map((a) => [a.productId, a._count._all]));
    const balanceMap = new Map(balances.map((b) => [b.productId, b._sum.quantity ?? 0]));
    return items.map((item) => {
      const serialAvail = serialMap.get(item.id) ?? 0;
      const balanceQty = balanceMap.get(item.id) ?? 0;
      return {
        ...item,
        availableUnits: serialAvail + balanceQty,
        serializedAvailable: serialAvail,
        openingBalance: balanceQty,
        totalUnits: item._count.inventoryUnits + balanceQty,
      };
    });
  }

  private async withAvailability<T extends { id: string; _count: { inventoryUnits: number } }>(
    item: T,
  ) {
    const [enriched] = await this.withAvailabilityMany([item]);
    return enriched;
  }
}
