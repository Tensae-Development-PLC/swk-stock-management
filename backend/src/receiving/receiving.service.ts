import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, ReceiptTokenPurpose, VerificationResult } from '@prisma/client';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { hashToken } from '../common/utils/token';
import { normalizeSerial, serialsMatch } from '../common/utils/serial';

@Injectable()
export class ReceivingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async preview(rawToken: string) {
    const { transfer, purpose } = await this.resolveToken(rawToken, 'RECEIVE');
    return { ...this.publicPayload(transfer), purpose };
  }

  async previewMaintenance(rawToken: string) {
    const { transfer, purpose } = await this.resolveToken(rawToken, 'MAINTENANCE');
    if (transfer.status !== 'RECEIVED') {
      throw new ConflictException(
        'Maintenance is available only after the transfer has been received.',
      );
    }
    return { ...this.publicPayload(transfer), purpose };
  }

  async verify(
    rawToken: string,
    scannedSerial: string,
    ip?: string,
    userAgent?: string,
    receiverName?: string,
    receiverPhone?: string,
    latitude?: number,
    longitude?: number,
    accuracy?: number,
  ) {
    const tokenHash = hashToken(rawToken);
    const scanned = normalizeSerial(scannedSerial);
    const name = receiverName?.trim();
    const phone = receiverPhone?.trim();
    if (!name || name.length < 2) {
      throw new UnprocessableEntityException('Receiver name is required.');
    }
    if (!phone || phone.length < 7) {
      throw new UnprocessableEntityException('Receiver phone number is required.');
    }
    this.assertGps(latitude, longitude, accuracy);

    const stored = await this.prisma.transferReceiptToken.findUnique({
      where: { tokenHash },
      include: {
        transfer: {
          include: {
            items: { include: { product: true } },
            sourceLocation: true,
            destinationLocation: true,
            reason: true,
          },
        },
      },
    });

    if (!stored) {
      throw new NotFoundException('Invalid receiving link.');
    }
    if (stored.purpose !== 'RECEIVE') {
      throw new BadRequestException('This link is not a receive link.');
    }

    const transfer = stored.transfer;

    if (stored.status === 'EXPIRED' || stored.expiresAt < new Date()) {
      await this.logAttempt(transfer.id, {
        result: 'EXPIRED_TOKEN',
        scannedSerialNumber: scanned,
        ip,
        userAgent,
        receiverName: name,
      });
      throw new GoneException('Receiving link has expired.');
    }

    if (stored.status === 'USED' || transfer.status === 'RECEIVED') {
      await this.logAttempt(transfer.id, {
        result: 'ALREADY_RECEIVED',
        scannedSerialNumber: scanned,
        ip,
        userAgent,
        receiverName: name,
      });
      throw new ConflictException('Transfer has already been received.');
    }

    if (['CANCELLED', 'REJECTED', 'EXPIRED'].includes(transfer.status)) {
      throw new ConflictException('This transfer is no longer awaiting receipt.');
    }

    const pendingItems = transfer.items.filter((item) => item.status !== 'RECEIVED');
    const matchedItem = pendingItems.find((item) =>
      serialsMatch(item.expectedSerialNumber, scanned),
    );

    if (!matchedItem) {
      const already = transfer.items.find(
        (item) => item.status === 'RECEIVED' && serialsMatch(item.expectedSerialNumber, scanned),
      );
      if (already) {
        await this.logAttempt(transfer.id, {
          result: 'ALREADY_RECEIVED',
          expectedSerialNumber: already.expectedSerialNumber,
          scannedSerialNumber: scanned,
          ip,
          userAgent,
          receiverName: name,
        });
        throw new ConflictException('This inventory item has already been received.');
      }

      await this.logAttempt(transfer.id, {
        result: 'MISMATCH',
        expectedSerialNumber: pendingItems.map((i) => i.expectedSerialNumber).join(','),
        scannedSerialNumber: scanned,
        ip,
        userAgent,
        receiverName: name,
      });
      await this.audit.log({
        action: 'RECEIVER_VERIFICATION_FAILED',
        entity: 'Transfer',
        entityId: transfer.id,
        newValue: { scanned, expected: pendingItems.map((i) => i.expectedSerialNumber) },
        ipAddress: ip,
        userAgent,
      });
      throw new UnprocessableEntityException(
        'Serial number does not match the item assigned to this transfer.',
      );
    }

    let completed = false;
    await this.prisma.$transaction(
      async (tx) => {
        await tx.transfer.update({
          where: { id: transfer.id },
          data: {
            receiverName: name,
            receiverPhone: phone,
            receivedLat: latitude,
            receivedLng: longitude,
            receivedAccuracyM: accuracy,
          },
        });

        await tx.transferItem.update({
          where: { id: matchedItem.id },
          data: {
            status: 'RECEIVED',
            scannedSerialNumber: scanned,
            receivedAt: new Date(),
          },
        });

        const locked = await tx.inventoryUnit.updateMany({
          where: {
            id: matchedItem.inventoryUnitId,
            status: { in: ['DISPATCHED', 'AWAITING_RECEIPT'] },
          },
          data: {
            status: 'IN_STOCK',
            currentLocationId: transfer.destinationLocationId,
            version: { increment: 1 },
          },
        });
        if (locked.count !== 1) {
          throw new ConflictException('Inventory unit is not in a receivable state.');
        }

        await tx.stockMovement.create({
          data: {
            inventoryUnitId: matchedItem.inventoryUnitId,
            productId: matchedItem.productId,
            movementType: 'TRANSFER_RECEIVED',
            quantity: 1,
            sourceLocationId: transfer.sourceLocationId,
            destinationLocationId: transfer.destinationLocationId,
            referenceNumber: transfer.referenceNumber,
            notes: 'Receiver serial verification matched.',
            transferId: transfer.id,
          },
        });

        const remaining = await tx.transferItem.count({
          where: { transferId: transfer.id, status: { not: 'RECEIVED' } },
        });
        if (remaining === 0) {
          completed = true;
          await tx.transfer.update({
            where: { id: transfer.id },
            data: { status: 'RECEIVED', receivedAt: new Date() },
          });
          await tx.transferReceiptToken.update({
            where: { id: stored.id },
            data: { status: 'USED', usedAt: new Date() },
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.logAttempt(transfer.id, {
      result: 'MATCH',
      expectedSerialNumber: matchedItem.expectedSerialNumber,
      scannedSerialNumber: scanned,
      ip,
      userAgent,
      receiverName: name,
    });
    await this.audit.log({
      action: 'RECEIVER_VERIFICATION',
      entity: 'Transfer',
      entityId: transfer.id,
      newValue: {
        scanned,
        itemId: matchedItem.id,
        receiverName: name,
        receiverPhone: phone,
        latitude,
        longitude,
        accuracy,
      },
      ipAddress: ip,
      userAgent,
    });

    if (completed) {
      await this.notifications.notify({
        type: 'TRANSFER_RECEIVED',
        title: 'Transfer received',
        body: `${transfer.referenceNumber} received by ${name} at ${latitude!.toFixed(5)}, ${longitude!.toFixed(5)} (±${Math.round(accuracy!)}m).`,
        entity: 'Transfer',
        entityId: transfer.id,
      });
    }

    const updated = await this.prisma.transfer.findUniqueOrThrow({
      where: { id: transfer.id },
      include: {
        items: { include: { product: true } },
        sourceLocation: true,
        destinationLocation: true,
        reason: true,
      },
    });

    return {
      message:
        updated.status === 'RECEIVED'
          ? 'Item received successfully. Transfer is complete.'
          : 'Item received successfully. Additional items on this transfer are still pending.',
      transfer: this.publicPayload(updated),
    };
  }

  async submitMaintenance(
    rawToken: string,
    input: {
      serialNumber: string;
      performedByName: string;
      performedByPhone: string;
      latitude: number;
      longitude: number;
      accuracy: number;
      notes?: string;
    },
    photo: Express.Multer.File,
    ip?: string,
    userAgent?: string,
  ) {
    if (!photo?.buffer?.length && !photo?.path) {
      throw new UnprocessableEntityException('A photo is required for maintenance proof.');
    }
    this.assertGps(input.latitude, input.longitude, input.accuracy);

    const name = input.performedByName?.trim();
    const phone = input.performedByPhone?.trim();
    if (!name || name.length < 2) {
      throw new UnprocessableEntityException('Name is required.');
    }
    if (!phone || phone.length < 7) {
      throw new UnprocessableEntityException('Phone number is required.');
    }

    const { transfer, token } = await this.resolveToken(rawToken, 'MAINTENANCE');
    if (transfer.status !== 'RECEIVED') {
      throw new ConflictException(
        'Maintenance is available only after the transfer has been received.',
      );
    }
    if (token.status !== 'ACTIVE') {
      throw new GoneException('Maintenance link is no longer active.');
    }

    const scanned = normalizeSerial(input.serialNumber);
    const matchedItem = transfer.items.find((item) =>
      serialsMatch(item.expectedSerialNumber, scanned),
    );
    if (!matchedItem) {
      throw new UnprocessableEntityException(
        'Serial number does not match an item on this transfer.',
      );
    }

    const photoPath = await this.storePhoto(transfer.id, photo);
    const event = await this.prisma.transferFieldEvent.create({
      data: {
        transferId: transfer.id,
        inventoryUnitId: matchedItem.inventoryUnitId,
        serialNumber: scanned,
        lat: input.latitude,
        lng: input.longitude,
        accuracyM: input.accuracy,
        photoPath,
        notes: input.notes?.trim() || null,
        performedByName: name,
        performedByPhone: phone,
      },
    });

    await this.audit.log({
      action: 'TRANSFER_MAINTENANCE',
      entity: 'TransferFieldEvent',
      entityId: event.id,
      newValue: {
        transferId: transfer.id,
        serial: scanned,
        latitude: input.latitude,
        longitude: input.longitude,
      },
      ipAddress: ip,
      userAgent,
    });

    await this.notifications.notify({
      type: 'TRANSFER_MAINTENANCE',
      title: 'Maintenance visit logged',
      body: `${transfer.referenceNumber}: ${scanned} visited by ${name} at ${input.latitude.toFixed(5)}, ${input.longitude.toFixed(5)}.`,
      entity: 'Transfer',
      entityId: transfer.id,
    });

    return {
      message: 'Maintenance visit recorded.',
      event: {
        id: event.id,
        serialNumber: event.serialNumber,
        createdAt: event.createdAt,
        lat: event.lat,
        lng: event.lng,
        accuracyM: event.accuracyM,
        notes: event.notes,
        performedByName: event.performedByName,
      },
    };
  }

  fieldEventPhotoPath(transferId: string, eventId: string) {
    return this.prisma.transferFieldEvent.findFirst({
      where: { id: eventId, transferId },
    });
  }

  private assertGps(latitude?: number, longitude?: number, accuracy?: number) {
    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      Number.isNaN(latitude) ||
      Number.isNaN(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new UnprocessableEntityException(
        'Location is required. Enable GPS and allow location access, then try again.',
      );
    }
    if (typeof accuracy !== 'number' || Number.isNaN(accuracy) || accuracy < 0) {
      throw new UnprocessableEntityException(
        'Location accuracy is required. Enable GPS and allow location access, then try again.',
      );
    }
  }

  private async storePhoto(transferId: string, file: Express.Multer.File) {
    const dir = join(process.cwd(), 'uploads', 'maintenance', transferId);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const ext =
      file.mimetype === 'image/png'
        ? 'png'
        : file.mimetype === 'image/webp'
          ? 'webp'
          : 'jpg';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const absolute = join(dir, filename);
    if (file.buffer) {
      const { writeFile } = await import('fs/promises');
      await writeFile(absolute, file.buffer);
    } else if (file.path) {
      const { copyFile } = await import('fs/promises');
      await copyFile(file.path, absolute);
    } else {
      await pipeline(Readable.from(file.stream as never), createWriteStream(absolute));
    }
    return join('uploads', 'maintenance', transferId, filename).replace(/\\/g, '/');
  }

  private async resolveToken(rawToken: string, purpose: ReceiptTokenPurpose) {
    const stored = await this.prisma.transferReceiptToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: {
        transfer: {
          include: {
            items: { include: { product: true } },
            sourceLocation: true,
            destinationLocation: true,
            reason: true,
          },
        },
      },
    });
    if (!stored) {
      throw new NotFoundException(
        purpose === 'MAINTENANCE' ? 'Invalid maintenance link.' : 'Invalid receiving link.',
      );
    }
    if (stored.purpose !== purpose) {
      throw new BadRequestException(
        purpose === 'MAINTENANCE'
          ? 'This link is not a maintenance link.'
          : 'This link is not a receive link.',
      );
    }
    if (stored.status === 'EXPIRED' || stored.expiresAt < new Date()) {
      throw new GoneException(
        purpose === 'MAINTENANCE'
          ? 'Maintenance link has expired.'
          : 'Receiving link has expired.',
      );
    }
    return { transfer: stored.transfer, purpose: stored.purpose, token: stored };
  }

  private publicPayload(transfer: {
    id: string;
    referenceNumber: string;
    status: string;
    receiverName: string;
    receiverPhone: string | null;
    dispatchDate: Date | null;
    destinationLocation: { name: string; code: string };
    sourceLocation: { name: string; code: string };
    reason: { name: string };
    items: {
      expectedSerialNumber: string;
      status: string;
      product: { itemName: string; model: string; unit: string; brand: string | null };
    }[];
  }) {
    return {
      message: 'You have been requested to receive an SWK inventory item.',
      referenceNumber: transfer.referenceNumber,
      status: transfer.status,
      receiverName: transfer.receiverName,
      destination: transfer.destinationLocation.name,
      source: transfer.sourceLocation.name,
      reason: transfer.reason.name,
      dispatchDate: transfer.dispatchDate,
      items: transfer.items.map((item) => ({
        itemName: item.product.itemName,
        model: item.product.model,
        unit: item.product.unit,
        brand: item.product.brand,
        serialNumber: item.expectedSerialNumber,
        receiptStatus: item.status,
      })),
    };
  }

  private logAttempt(
    transferId: string,
    data: {
      result: VerificationResult;
      expectedSerialNumber?: string;
      scannedSerialNumber?: string;
      ip?: string;
      userAgent?: string;
      receiverName?: string;
    },
  ) {
    return this.prisma.verificationLog.create({
      data: {
        transferId,
        result: data.result,
        expectedSerialNumber: data.expectedSerialNumber,
        scannedSerialNumber: data.scannedSerialNumber,
        ipAddress: data.ip,
        userAgent: data.userAgent,
        receiverName: data.receiverName,
      },
    });
  }
}
