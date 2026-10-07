-- Product catalog remark from Excel
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "catalogRemark" TEXT;

-- Inventory units: stock year
ALTER TABLE "inventory_units" ADD COLUMN IF NOT EXISTS "stockYear" INTEGER;
CREATE INDEX IF NOT EXISTS "inventory_units_stockYear_idx" ON "inventory_units"("stockYear");

-- Inventory balances: add stockYear and change unique key
ALTER TABLE "inventory_balances" ADD COLUMN IF NOT EXISTS "stockYear" INTEGER NOT NULL DEFAULT 2018;

-- Drop old unique if present, create new composite unique
ALTER TABLE "inventory_balances" DROP CONSTRAINT IF EXISTS "inventory_balances_productId_locationId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_balances_productId_locationId_stockYear_key"
  ON "inventory_balances"("productId", "locationId", "stockYear");
CREATE INDEX IF NOT EXISTS "inventory_balances_stockYear_idx" ON "inventory_balances"("stockYear");

-- Stock in batches
ALTER TABLE "stock_in_batches" ADD COLUMN IF NOT EXISTS "stockYear" INTEGER;
ALTER TABLE "stock_in_batches" ADD COLUMN IF NOT EXISTS "fsNumber" TEXT;
UPDATE "stock_in_batches" SET "stockYear" = EXTRACT(YEAR FROM "purchaseDate")::INTEGER WHERE "stockYear" IS NULL;
UPDATE "stock_in_batches" SET "fsNumber" = "referenceNumber" WHERE "fsNumber" IS NULL;
ALTER TABLE "stock_in_batches" ALTER COLUMN "stockYear" SET NOT NULL;
ALTER TABLE "stock_in_batches" ALTER COLUMN "fsNumber" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "stock_in_batches_stockYear_idx" ON "stock_in_batches"("stockYear");
CREATE INDEX IF NOT EXISTS "stock_in_batches_fsNumber_idx" ON "stock_in_batches"("fsNumber");

-- Sales
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "stockYear" INTEGER;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "fsNumber" TEXT;
UPDATE "sales" SET "stockYear" = EXTRACT(YEAR FROM "saleDate")::INTEGER WHERE "stockYear" IS NULL;
UPDATE "sales" SET "fsNumber" = "referenceNumber" WHERE "fsNumber" IS NULL;
ALTER TABLE "sales" ALTER COLUMN "stockYear" SET NOT NULL;
ALTER TABLE "sales" ALTER COLUMN "fsNumber" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "sales_stockYear_idx" ON "sales"("stockYear");
CREATE INDEX IF NOT EXISTS "sales_fsNumber_idx" ON "sales"("fsNumber");

-- Transfers
ALTER TABLE "transfers" ADD COLUMN IF NOT EXISTS "stockYear" INTEGER;
ALTER TABLE "transfers" ADD COLUMN IF NOT EXISTS "fsNumber" TEXT;
UPDATE "transfers" SET "stockYear" = COALESCE(EXTRACT(YEAR FROM "dispatchDate")::INTEGER, EXTRACT(YEAR FROM "createdAt")::INTEGER) WHERE "stockYear" IS NULL;
UPDATE "transfers" SET "fsNumber" = "referenceNumber" WHERE "fsNumber" IS NULL;
ALTER TABLE "transfers" ALTER COLUMN "stockYear" SET NOT NULL;
ALTER TABLE "transfers" ALTER COLUMN "fsNumber" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "transfers_stockYear_idx" ON "transfers"("stockYear");
CREATE INDEX IF NOT EXISTS "transfers_fsNumber_idx" ON "transfers"("fsNumber");
