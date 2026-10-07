import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { PaginationQueryDto, paginationArgs, paginatedMeta } from '../common/dto/pagination-query.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCategoryDto) {
    const code = dto.code.trim().toUpperCase();
    const existing = await this.prisma.category.findFirst({
      where: { OR: [{ code }, { name: dto.name.trim() }] },
    });
    if (existing) {
      throw new ConflictException('Category name or code already exists.');
    }
    return this.prisma.category.create({
      data: { name: dto.name.trim(), code, description: dto.description },
    });
  }

  async findAll(query: PaginationQueryDto) {
    const { skip, take, page, limit } = paginationArgs(query);
    const where: Prisma.CategoryWhereInput = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { code: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        skip,
        take,
        orderBy: { name: 'asc' },
      }),
      this.prisma.category.count({ where }),
    ]);
    return { items, meta: paginatedMeta(total, page, limit) };
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Category not found.');
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOne(id);
    return this.prisma.category.update({ where: { id }, data: dto });
  }
}
