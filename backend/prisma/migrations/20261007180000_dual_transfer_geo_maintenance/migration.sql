-- CreateEnum
CREATE TYPE "ReceiptTokenPurpose" AS ENUM ('RECEIVE', 'MAINTENANCE');

-- AlterTable Transfer: receive GPS
ALTER TABLE "transfers" ADD COLUMN IF NOT EXISTS "receivedLat" DOUBLE PRECISION;
ALTER TABLE "transfers" ADD COLUMN IF NOT EXISTS "receivedLng" DOUBLE PRECISION;
ALTER TABLE "transfers" ADD COLUMN IF NOT EXISTS "receivedAccuracyM" DOUBLE PRECISION;

-- AlterTable TransferReceiptToken: purpose
ALTER TABLE "transfer_receipt_tokens" ADD COLUMN IF NOT EXISTS "purpose" "ReceiptTokenPurpose" NOT NULL DEFAULT 'RECEIVE';
CREATE INDEX IF NOT EXISTS "transfer_receipt_tokens_purpose_idx" ON "transfer_receipt_tokens"("purpose");

-- CreateTable TransferFieldEvent
CREATE TABLE IF NOT EXISTS "transfer_field_events" (
    "id" UUID NOT NULL,
    "transferId" UUID NOT NULL,
    "inventoryUnitId" UUID NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "accuracyM" DOUBLE PRECISION,
    "photoPath" TEXT NOT NULL,
    "notes" TEXT,
    "performedByName" TEXT NOT NULL,
    "performedByPhone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_field_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "transfer_field_events_transferId_idx" ON "transfer_field_events"("transferId");
CREATE INDEX IF NOT EXISTS "transfer_field_events_inventoryUnitId_idx" ON "transfer_field_events"("inventoryUnitId");
CREATE INDEX IF NOT EXISTS "transfer_field_events_createdAt_idx" ON "transfer_field_events"("createdAt");

ALTER TABLE "transfer_field_events" DROP CONSTRAINT IF EXISTS "transfer_field_events_transferId_fkey";
ALTER TABLE "transfer_field_events" ADD CONSTRAINT "transfer_field_events_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "transfer_field_events" DROP CONSTRAINT IF EXISTS "transfer_field_events_inventoryUnitId_fkey";
ALTER TABLE "transfer_field_events" ADD CONSTRAINT "transfer_field_events_inventoryUnitId_fkey" FOREIGN KEY ("inventoryUnitId") REFERENCES "inventory_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable StaffNotification
CREATE TABLE IF NOT EXISTS "staff_notifications" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "staff_notifications_userId_idx" ON "staff_notifications"("userId");
CREATE INDEX IF NOT EXISTS "staff_notifications_readAt_idx" ON "staff_notifications"("readAt");
CREATE INDEX IF NOT EXISTS "staff_notifications_createdAt_idx" ON "staff_notifications"("createdAt");

ALTER TABLE "staff_notifications" DROP CONSTRAINT IF EXISTS "staff_notifications_userId_fkey";
ALTER TABLE "staff_notifications" ADD CONSTRAINT "staff_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
