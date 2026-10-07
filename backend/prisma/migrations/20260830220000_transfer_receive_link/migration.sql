-- AlterTable
ALTER TABLE "transfers" ALTER COLUMN "receiverName" SET DEFAULT 'Awaiting receiver';

-- AlterTable
ALTER TABLE "transfer_receipt_tokens" ADD COLUMN IF NOT EXISTS "tokenPlain" TEXT;
