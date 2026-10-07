import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/types/auth-user.type';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Broadcast to staff roles when userId is omitted. */
  async notify(input: {
    type: string;
    title: string;
    body: string;
    entity?: string;
    entityId?: string;
    userId?: string | null;
  }) {
    return this.prisma.staffNotification.create({
      data: {
        userId: input.userId ?? null,
        type: input.type,
        title: input.title,
        body: input.body,
        entity: input.entity,
        entityId: input.entityId,
      },
    });
  }

  async listForUser(user: AuthUser, limit = 20) {
    const seesBroadcast = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STOREKEEPER'].includes(user.role);

    const items = await this.prisma.staffNotification.findMany({
      where: {
        OR: [{ userId: user.id }, ...(seesBroadcast ? [{ userId: null }] : [])],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const unreadCount = await this.prisma.staffNotification.count({
      where: {
        readAt: null,
        OR: [{ userId: user.id }, ...(seesBroadcast ? [{ userId: null }] : [])],
      },
    });

    return { items, unreadCount };
  }

  async markRead(id: string, user: AuthUser) {
    const row = await this.prisma.staffNotification.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Notification not found.');
    if (row.userId && row.userId !== user.id) {
      throw new NotFoundException('Notification not found.');
    }
    return this.prisma.staffNotification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(user: AuthUser) {
    const seesBroadcast = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STOREKEEPER'].includes(user.role);
    await this.prisma.staffNotification.updateMany({
      where: {
        readAt: null,
        OR: [{ userId: user.id }, ...(seesBroadcast ? [{ userId: null }] : [])],
      },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
