/**
 * Import SWK HVACR sheet 1 into products + 2018 opening balances.
 * Usage: npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" prisma/import-swk-excel.ts
 */
import * as path from 'path';
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';
import * as ExcelJS from 'exceljs';

const prisma = new PrismaClient();
const OPENING_YEAR = 2018;
const SHEET_NAME = 'Swk Hvacr solution';

function cellText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object' && value !== null && 'text' in (value as object)) {
    return String((value as { text: string }).text ?? '').trim();
  }
  if (typeof value === 'object' && value !== null && 'result' in (value as object)) {
    return String((value as { result: unknown }).result ?? '').trim();
  }
  return String(value).trim();
}

function guessCategoryCode(itemName: string): string {
  const n = itemName.toLowerCase();
  if (n.includes('compressor')) return 'COMP';
  if (n.includes('air condition') || n.includes(' a/c') || n.includes('ac ') || n.includes('floor stand'))
    return 'AC';
  if (n.includes('refrigerant') || n.includes('gas') || n.includes('r134') || n.includes('r404'))
    return 'GAS';
  if (
    n.includes('fan') ||
    n.includes('capacitor') ||
    n.includes('relay') ||
    n.includes('thermostat') ||
    n.includes('filter') ||
    n.includes('motor')
  )
    return 'SPARE';
  if (n.includes('cold room') || n.includes('condensing') || n.includes('evaporat')) return 'REF';
  return 'OTHER';
}

async function main() {
  const filePath =
    process.argv[2] ||
    path.join(__dirname, '..', 'data', 'swk-inventory.xlsx');

  if (!fs.existsSync(filePath)) {
    throw new Error(`Excel file not found: ${filePath}`);
  }

  const categories = await prisma.category.findMany();
  const categoryByCode = new Map(categories.map((c) => [c.code, c.id]));
  if (!categoryByCode.has('OTHER')) {
    throw new Error('Categories missing. Run prisma db seed first.');
  }

  const hq =
    (await prisma.location.findUnique({ where: { code: 'ADDIS' } })) ||
    (await prisma.location.findFirst({ where: { isActive: true } }));
  if (!hq) throw new Error('No location found. Run prisma db seed first.');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.getWorksheet(SHEET_NAME) || workbook.worksheets[0];
  if (!sheet) throw new Error('Worksheet not found');

  let imported = 0;
  let skipped = 0;
  let totalQty = 0;

  for (let rowNumber = 10; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const bcRaw = cellText(row.getCell(2).value);
    const itemName = cellText(row.getCell(3).value);
    const modelRaw = cellText(row.getCell(4).value);
    const unit = cellText(row.getCell(5).value) || 'PCS';
    const qtyRaw = cellText(row.getCell(6).value);
    const remark = cellText(row.getCell(7).value) || null;

    // Stop at vehicle trailer section
    if (bcRaw.toLowerCase() === 'no' && itemName.toLowerCase().includes('description')) {
      break;
    }
    if (!itemName || itemName.toLowerCase() === 'description') {
      skipped += 1;
      continue;
    }
    if (!/^\d+$/.test(bcRaw)) {
      skipped += 1;
      continue;
    }

    const bcNumber = String(Number(bcRaw)); // normalize "001" / 1 → "1" then pad
    const paddedBc = bcNumber.padStart(3, '0');
    const model = modelRaw || '—';
    const quantity = Math.max(0, Math.round(Number(qtyRaw) || 0));
    const categoryId = categoryByCode.get(guessCategoryCode(itemName)) || categoryByCode.get('OTHER')!;

    const product = await prisma.product.upsert({
      where: { bcNumber: paddedBc },
      update: {
        itemName,
        model,
        unit,
        catalogRemark: remark,
        categoryId,
        isActive: true,
        isSerialized: true,
      },
      create: {
        bcNumber: paddedBc,
        itemName,
        model,
        unit,
        catalogRemark: remark,
        categoryId,
        isSerialized: true,
        isActive: true,
      },
    });

    await prisma.inventoryBalance.upsert({
      where: {
        productId_locationId_stockYear: {
          productId: product.id,
          locationId: hq.id,
          stockYear: OPENING_YEAR,
        },
      },
      update: { quantity },
      create: {
        productId: product.id,
        locationId: hq.id,
        stockYear: OPENING_YEAR,
        quantity,
      },
    });

    imported += 1;
    totalQty += quantity;
  }

  console.log(
    JSON.stringify(
      {
        sheet: sheet.name,
        imported,
        skipped,
        totalOpeningQty: totalQty,
        location: hq.code,
        stockYear: OPENING_YEAR,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
