import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  StreamableFile,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ReceiptTokenPurpose } from '@prisma/client';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { AuthUser } from '../auth/types/auth-user.type';
import { findDuplicateSerials, normalizeSerial } from '../common/utils/serial';
import { generateSecureToken, hashToken } from '../common/utils/token';
import { PaginationQueryDto, paginationArgs, paginatedMeta } from '../common/dto/pagination-query.dto';
@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}
  async create(dto: CreateTransferDto, actor: AuthUser, ip?: string) {
    if (dto.sourceLocationId === dto.destinationLocationId) {
      throw new BadRequestException('Source and destination locations must be different.');
    }
    const serials = dto.serialNumbers.map(normalizeSerial);
    const duplicates = findDuplicateSerials(serials);
    if (duplicates.length) {
      throw new ConflictException(`Duplicate serial numbers: ${duplicates.join(', ')}`);
    }
    const [source, destination, reason] = await Promise.all([
      this.prisma.location.findUnique({ where: { id: dto.sourceLocationId } }),
      this.prisma.location.findUnique({ where: { id: dto.destinationLocationId } }),
      this.prisma.transferReason.findUnique({ where: { id: dto.reasonId } }),
    ]);
    if (!source?.isActive) throw new NotFoundException('Source location not found or inactive.');
    if (!destination?.isActive) {
      throw new NotFoundException('Destination location not found or inactive.');
    }
    if (!reason?.isActive) throw new NotFoundException('Transfer reason not found or inactive.');
    const receiveRaw = generateSecureToken();
    const maintenanceRaw = generateSecureToken();
    const ttlHours = Number(this.config.get('RECEIVING_TOKEN_TTL_HOURS') ?? 168);
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    const transfer = await this.prisma.$transaction(
      async (tx) => {
        const referenceNumber = await this.nextRef(tx, 'TR');
        const row = await tx.transfer.create({
          data: {
            referenceNumber,
            sourceLocationId: source.id,
            destinationLocationId: destination.id,
            reasonId: reason.id,
            status: 'AWAITING_RECEIPT',
            receiverName: dto.receiverName?.trim() || 'Awaiting receiver',
            receiverPhone: dto.receiverPhone?.trim() || null,
            stockYear: dto.stockYear,
            fsNumber: dto.fsNumber.trim(),
            dispatchDate: dto.dispatchDate ? new Date(dto.dispatchDate) : new Date(),
            notes: dto.notes,
            createdById: actor.id,
            dispatchedById: actor.id,
          },
        });
        for (const serial of serials) {
          const unit = await tx.inventoryUnit.findUnique({ where: { serialNumber: serial } });
          if (!unit) {
            throw new NotFoundException(`Inventory unit not found for serial ${serial}.`);
          }
          if (unit.status === 'SOLD') {
            throw new UnprocessableEntityException(
              `Inventory unit ${serial} is not available for sale.`,
            );
          }
          if (unit.status === 'DISPATCHED' || unit.status === 'AWAITING_RECEIPT') {
            throw new ConflictException(`Inventory unit ${serial} has already been dispatched.`);
          }
          if (unit.status !== 'IN_STOCK' && unit.status !== 'RECEIVED') {
            throw new UnprocessableEntityException(
              `Inventory unit ${serial} is not available for transfer.`,
            );
          }
          if (unit.currentLocationId !== source.id) {
            throw new UnprocessableEntityException(
              `Inventory unit ${serial} is not at the source location.`,
            );
          }
          const locked = await tx.inventoryUnit.updateMany({
            where: {
              id: unit.id,
              status: { in: ['IN_STOCK', 'RECEIVED'] },
              version: unit.version,
            },
            data: { status: 'DISPATCHED', version: { increment: 1 } },
          });
          if (locked.count !== 1) {
            throw new ConflictException(`Inventory unit ${serial} has already been dispatched.`);
          }
          await tx.transferItem.create({
            data: {
              transferId: row.id,
              inventoryUnitId: unit.id,
              productId: unit.productId,
              expectedSerialNumber: serial,
              status: 'DISPATCHED',
            },
          });
          await tx.stockMovement.create({
            data: {
              inventoryUnitId: unit.id,
              productId: unit.productId,
              movementType: 'TRANSFER_OUT',
              quantity: 1,
              sourceLocationId: source.id,
              destinationLocationId: destination.id,
              purchasePrice: unit.purchasePrice,
              referenceNumber,
              notes: dto.notes,
              performedById: actor.id,
              transferId: row.id,
            },
          });
        }
        await tx.transferReceiptToken.create({
          data: {
            transferId: row.id,
            purpose: 'RECEIVE',
            tokenHash: hashToken(receiveRaw),
            tokenPlain: receiveRaw,
            expiresAt,
            status: 'ACTIVE',
          },
        });
        await tx.transferReceiptToken.create({
          data: {
            transferId: row.id,
            purpose: 'MAINTENANCE',
            tokenHash: hashToken(maintenanceRaw),
            tokenPlain: maintenanceRaw,
            expiresAt,
            status: 'ACTIVE',
          },
        });
        return row;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    await this.audit.log({
      userId: actor.id,
      action: 'TRANSFER_CREATE',
      entity: 'Transfer',
      entityId: transfer.id,
      newValue: {
        referenceNumber: transfer.referenceNumber,
        serials,
        destination: destination.code,
        receiverName: dto.receiverName?.trim() || 'Awaiting receiver',
      },
      ipAddress: ip,
    });
    await this.audit.log({
      userId: actor.id,
      action: 'TRANSFER_DISPATCH',
      entity: 'Transfer',
      entityId: transfer.id,
      ipAddress: ip,
    });
    const created = await this.findOne(transfer.id);
    return {
      ...created,
      receivingToken: receiveRaw,
      receivingUrl: this.receivingUrl(receiveRaw),
      maintenanceToken: maintenanceRaw,
      maintenanceUrl: this.maintenanceUrl(maintenanceRaw),
    };
  }
  async findAll(
    query: PaginationQueryDto & {
      status?: string;
      destinationLocationId?: string;
      fsNumber?: string;
      stockYear?: string;
    },
  ) {
    const { skip, take, page, limit } = paginationArgs(query);
    const year = query.stockYear ? Number(query.stockYear) : undefined;
    const where: Prisma.TransferWhereInput = {
      ...(query.status ? { status: query.status as never } : {}),
      ...(query.destinationLocationId
        ? { destinationLocationId: query.destinationLocationId }
        : {}),
      ...(query.fsNumber
        ? { fsNumber: { contains: query.fsNumber.trim(), mode: 'insensitive' } }
        : {}),
      ...(year && !Number.isNaN(year) ? { stockYear: year } : {}),
      ...(query.search
        ? {
            OR: [
              { referenceNumber: { contains: query.search, mode: 'insensitive' } },
              { fsNumber: { contains: query.search, mode: 'insensitive' } },
              { receiverName: { contains: query.search, mode: 'insensitive' } },
              {
                items: {
                  some: { expectedSerialNumber: { contains: query.search, mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.transfer.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: query.sortOrder ?? 'desc' },
        include: {
          sourceLocation: true,
          destinationLocation: true,
          reason: true,
          items: {
            include: {
              product: { select: { id: true, itemName: true, model: true, brand: true } },
            },
          },
          _count: { select: { fieldEvents: true } },
        },
      }),
      this.prisma.transfer.count({ where }),
    ]);
    return {
      items: items.map((row) => {
        const maintenanceVisitCount = row._count.fieldEvents;
        return {
          ...row,
          maintenanceVisitCount,
          lifecycleStage: this.lifecycleStage(row.status, maintenanceVisitCount),
        };
      }),
      meta: paginatedMeta(total, page, limit),
    };
  }

  lifecycleStage(status: string, maintenanceVisitCount: number) {
    if (['CANCELLED', 'REJECTED', 'EXPIRED'].includes(status)) return 'CLOSED';
    if (status === 'AWAITING_RECEIPT' || status === 'DISPATCHED' || status === 'CREATED') {
      return 'AWAITING_RECEIVE';
    }
    if (status === 'RECEIVED') {
      return maintenanceVisitCount > 0 ? 'MAINTENANCE_DONE' : 'PENDING_MAINTENANCE';
    }
    return status;
  }

  async findOne(id: string) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id },
      include: {
        sourceLocation: true,
        destinationLocation: true,
        reason: true,
        items: { include: { product: true, inventoryUnit: true } },
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        verificationLogs: { orderBy: { attemptedAt: 'desc' }, take: 20 },
        fieldEvents: { orderBy: { createdAt: 'desc' } },
        tokens: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!transfer) throw new NotFoundException('Transfer not found.');
    const linked = this.withPublicLinks(transfer);
    const maintenanceVisitCount = transfer.fieldEvents.length;
    return {
      ...linked,
      maintenanceVisitCount,
      lifecycleStage: this.lifecycleStage(transfer.status, maintenanceVisitCount),
    };
  }
  async ensureReceivingLink(id: string, actor: AuthUser, ip?: string) {
    return this.ensureLink(id, 'RECEIVE', actor, ip);
  }
  async ensureMaintenanceLink(id: string, actor: AuthUser, ip?: string) {
    const transfer = await this.findOne(id);
    if (transfer.status !== 'RECEIVED') {
      throw new ConflictException('Maintenance link unlocks only after the transfer is received.');
    }
    return this.ensureLink(id, 'MAINTENANCE', actor, ip);
  }
  private async ensureLink(
    id: string,
    purpose: ReceiptTokenPurpose,
    actor: AuthUser,
    ip?: string,
  ) {
    const transfer = await this.findOne(id);
    if (purpose === 'RECEIVE') {
      if (transfer.status === 'RECEIVED') {
        throw new ConflictException('Transfer already received. Receiving link is disabled.');
      }
      if (['CANCELLED', 'REJECTED', 'EXPIRED'].includes(transfer.status)) {
        throw new ConflictException('This transfer is no longer awaiting receipt.');
      }
    }
    const active = await this.prisma.transferReceiptToken.findFirst({
      where: { transferId: id, purpose, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    if (active?.tokenPlain && active.expiresAt > new Date()) {
      const links =
        purpose === 'RECEIVE'
          ? {
              receivingToken: active.tokenPlain,
              receivingUrl: this.receivingUrl(active.tokenPlain),
              receivingLinkActive: true,
            }
          : {
              maintenanceToken: active.tokenPlain,
              maintenanceUrl: this.maintenanceUrl(active.tokenPlain),
              maintenanceLinkActive: true,
            };
      return { ...transfer, ...links };
    }
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const ttlHours = Number(this.config.get('RECEIVING_TOKEN_TTL_HOURS') ?? 168);
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    await this.prisma.$transaction(async (tx) => {
      if (active) {
        await tx.transferReceiptToken.update({
          where: { id: active.id },
          data: { status: 'EXPIRED' },
        });
      }
      await tx.transferReceiptToken.create({
        data: {
          transferId: id,
          purpose,
          tokenHash,
          tokenPlain: rawToken,
          expiresAt,
          status: 'ACTIVE',
        },
      });
    });
    await this.audit.log({
      userId: actor.id,
      action:
        purpose === 'RECEIVE'
          ? 'TRANSFER_RECEIVING_LINK_REFRESH'
          : 'TRANSFER_MAINTENANCE_LINK_REFRESH',
      entity: 'Transfer',
      entityId: id,
      ipAddress: ip,
    });
    const refreshed = await this.findOne(id);
    if (purpose === 'RECEIVE') {
      return {
        ...refreshed,
        receivingToken: rawToken,
        receivingUrl: this.receivingUrl(rawToken),
        receivingLinkActive: true,
      };
    }
    return {
      ...refreshed,
      maintenanceToken: rawToken,
      maintenanceUrl: this.maintenanceUrl(rawToken),
      maintenanceLinkActive: true,
    };
  }
  private withPublicLinks<
    T extends {
      id: string;
      status: string;
      tokens?: {
        purpose: string;
        tokenPlain: string | null;
        expiresAt: Date;
        status: string;
      }[];
      fieldEvents?: { id: string; photoPath: string }[];
    },
  >(transfer: T) {
    const pending = transfer.status === 'AWAITING_RECEIPT' || transfer.status === 'DISPATCHED';
    const received = transfer.status === 'RECEIVED';
    const now = new Date();
    const receiveTok = transfer.tokens?.find((t) => t.purpose === 'RECEIVE');
    const maintTok = transfer.tokens?.find((t) => t.purpose === 'MAINTENANCE');
    const receivePlain = receiveTok?.tokenPlain;
    const receiveActive =
      pending &&
      !!receivePlain &&
      receiveTok?.status === 'ACTIVE' &&
      receiveTok.expiresAt > now;
    const maintPlain = maintTok?.tokenPlain;
    const maintActive =
      received &&
      !!maintPlain &&
      maintTok?.status === 'ACTIVE' &&
      maintTok.expiresAt > now;
    const { tokens: _tokens, fieldEvents, ...rest } = transfer as T & {
      tokens?: unknown;
      fieldEvents?: Array<Record<string, unknown> & { id: string; photoPath?: string }>;
    };
    const events = (fieldEvents ?? []).map((e) => {
      const { photoPath: _p, ...eventRest } = e;
      return {
        ...eventRest,
        hasPhoto: Boolean(e.photoPath),
        photoUrl: `/transfers/${transfer.id}/field-events/${e.id}/photo`,
      };
    });
    return {
      ...rest,
      fieldEvents: events,
      receivingToken: receiveActive ? receivePlain : undefined,
      receivingUrl: receiveActive ? this.receivingUrl(receivePlain!) : undefined,
      receivingLinkActive: Boolean(receiveActive),
      receivingLinkDisabled: !pending || received,
      maintenanceToken: maintActive ? maintPlain : undefined,
      maintenanceUrl: maintActive ? this.maintenanceUrl(maintPlain!) : undefined,
      maintenanceLinkActive: Boolean(maintActive),
      maintenanceLinkLocked: !received,
    };
  }
  async streamFieldEventPhoto(transferId: string, eventId: string) {
    const event = await this.prisma.transferFieldEvent.findFirst({
      where: { id: eventId, transferId },
    });
    if (!event) throw new NotFoundException('Field event not found.');
    const absolute = join(process.cwd(), event.photoPath);
    if (!existsSync(absolute)) throw new NotFoundException('Photo file not found.');
    const stream = createReadStream(absolute);
    const ext = event.photoPath.split('.').pop()?.toLowerCase();
    const type =
      ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return new StreamableFile(stream, { type, disposition: `inline; filename="${eventId}.${ext}"` });
  }
  async cancel(id: string, actor: AuthUser, ip?: string) {
    const transfer = await this.findOne(id);
    if (['RECEIVED', 'CANCELLED', 'REJECTED'].includes(transfer.status)) {
      throw new ConflictException('This transfer cannot be cancelled.');
    }
    await this.prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        if (item.status === 'RECEIVED') continue;
        await tx.inventoryUnit.updateMany({
          where: {
            id: item.inventoryUnitId,
            status: { in: ['DISPATCHED', 'AWAITING_RECEIPT'] },
          },
          data: {
            status: 'IN_STOCK',
            currentLocationId: transfer.sourceLocationId,
            version: { increment: 1 },
          },
        });
        await tx.transferItem.update({
          where: { id: item.id },
          data: { status: 'CANCELLED' },
        });
      }
      await tx.transfer.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      await tx.transferReceiptToken.updateMany({
        where: { transferId: id, status: 'ACTIVE' },
        data: { status: 'REVOKED' },
      });
    });
    await this.audit.log({
      userId: actor.id,
      action: 'TRANSFER_CANCEL',
      entity: 'Transfer',
      entityId: id,
      ipAddress: ip,
    });
    return this.findOne(id);
  }
  async listReasons() {
    return this.prisma.transferReason.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }
  receivingUrl(token: string) {
    const base =
      this.config.get<string>('RECEIVING_PUBLIC_BASE_URL') ?? 'http://localhost:3001/receive';
    return `${base.replace(/\/$/, '')}/${token}`;
  }
  maintenanceUrl(token: string) {
    const configured = this.config.get<string>('MAINTENANCE_PUBLIC_BASE_URL');
    if (configured) return `${configured.replace(/\/$/, '')}/${token}`;
    const receiveBase =
      this.config.get<string>('RECEIVING_PUBLIC_BASE_URL') ?? 'http://localhost:3001/receive';
    const appBase = receiveBase.replace(/\/receive\/?$/, '');
    return `${appBase}/maintain/${token}`;
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
