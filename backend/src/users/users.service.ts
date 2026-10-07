import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { PaginationQueryDto, paginationArgs, paginatedMeta } from '../common/dto/pagination-query.dto';
import { AuthUser } from '../auth/types/auth-user.type';

const userInclude = {
  role: { select: { id: true, name: true, description: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateUserDto, actor: AuthUser, ip?: string) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists.');
    }
    const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
    if (!role) {
      throw new NotFoundException('Role not found.');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await argon2.hash(dto.password),
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        roleId: dto.roleId,
      },
      include: userInclude,
    });

    await this.audit.log({
      userId: actor.id,
      action: 'USER_CREATE',
      entity: 'User',
      entityId: user.id,
      newValue: { email: user.email, role: role.name },
      ipAddress: ip,
    });

    return this.sanitize(user);
  }

  async findAll(query: PaginationQueryDto) {
    const { skip, take, page, limit } = paginationArgs(query);
    const where: Prisma.UserWhereInput = query.search
      ? {
          OR: [
            { email: { contains: query.search, mode: 'insensitive' } },
            { firstName: { contains: query.search, mode: 'insensitive' } },
            { lastName: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: query.sortOrder ?? 'desc' },
        include: userInclude,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items: items.map((u) => this.sanitize(u)), meta: paginatedMeta(total, page, limit) };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: userInclude });
    if (!user) throw new NotFoundException('User not found.');
    return this.sanitize(user);
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthUser, ip?: string) {
    const existing = await this.prisma.user.findUnique({ where: { id }, include: userInclude });
    if (!existing) throw new NotFoundException('User not found.');

    if (dto.roleId) {
      const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
      if (!role) throw new NotFoundException('Role not found.');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        roleId: dto.roleId,
        isActive: dto.isActive,
        ...(dto.password ? { passwordHash: await argon2.hash(dto.password) } : {}),
      },
      include: userInclude,
    });

    await this.audit.log({
      userId: actor.id,
      action: dto.roleId && dto.roleId !== existing.roleId ? 'USER_ROLE_CHANGE' : 'USER_UPDATE',
      entity: 'User',
      entityId: id,
      oldValue: { role: existing.role.name, isActive: existing.isActive },
      newValue: { role: user.role.name, isActive: user.isActive },
      ipAddress: ip,
    });

    return this.sanitize(user);
  }

  async listRoles() {
    return this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: { permissions: { include: { permission: true } } },
    });
  }

  private sanitize(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    isActive: boolean;
    roleId: string;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    role: { id: string; name: string; description: string | null };
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      isActive: user.isActive,
      roleId: user.roleId,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      role: user.role,
    };
  }
}
