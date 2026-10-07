import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocationDto, UpdateLocationDto } from './dto/location.dto';
import { PaginationQueryDto, paginationArgs, paginatedMeta } from '../common/dto/pagination-query.dto';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLocationDto) {
    const code = dto.code.trim().toUpperCase().replace(/\s+/g, '_');
    const existing = await this.prisma.location.findUnique({ where: { code } });
    if (existing) throw new ConflictException('Location code already exists.');
    return this.prisma.location.create({
      data: {
        name: dto.name.trim(),
        code,
        address: dto.address,
        contactPerson: dto.contactPerson,
        phone: dto.phone,
      },
    });
  }

  async findAll(query: PaginationQueryDto) {
    const { skip, take, page, limit } = paginationArgs(query);
    const where: Prisma.LocationWhereInput = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { code: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.location.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
      this.prisma.location.count({ where }),
    ]);
    return { items, meta: paginatedMeta(total, page, limit) };
  }

  async findOne(id: string) {
    const location = await this.prisma.location.findUnique({ where: { id } });
    if (!location) throw new NotFoundException('Location not found.');
    return location;
  }

  async update(id: string, dto: UpdateLocationDto) {
    await this.findOne(id);
    return this.prisma.location.update({ where: { id }, data: dto });
  }
}
