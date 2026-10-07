import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const PERMISSIONS: { code: string; description: string }[] = [
  { code: 'PRODUCT_CREATE', description: 'Create products' },
  { code: 'PRODUCT_VIEW', description: 'View products' },
  { code: 'PRODUCT_UPDATE', description: 'Update products' },
  { code: 'CATEGORY_CREATE', description: 'Create categories' },
  { code: 'CATEGORY_VIEW', description: 'View categories' },
  { code: 'CATEGORY_UPDATE', description: 'Update categories' },
  { code: 'LOCATION_CREATE', description: 'Create locations' },
  { code: 'LOCATION_VIEW', description: 'View locations' },
  { code: 'LOCATION_UPDATE', description: 'Update locations' },
  { code: 'STOCK_IN_CREATE', description: 'Perform stock in' },
  { code: 'STOCK_IN_VIEW', description: 'View stock in' },
  { code: 'STOCK_OUT_CREATE', description: 'Perform stock out' },
  { code: 'STOCK_OUT_VIEW', description: 'View stock out' },
  { code: 'SALE_CREATE', description: 'Create direct sales' },
  { code: 'SALE_VIEW', description: 'View sales' },
  { code: 'TRANSFER_CREATE', description: 'Create regional transfers' },
  { code: 'TRANSFER_VIEW', description: 'View transfers' },
  { code: 'TRANSFER_DISPATCH', description: 'Dispatch transfers' },
  { code: 'TRANSFER_RECEIVE', description: 'Confirm transfer receipt internally' },
  { code: 'TRANSFER_CANCEL', description: 'Cancel transfers' },
  { code: 'INVENTORY_VIEW', description: 'View inventory units' },
  { code: 'INVENTORY_ADJUST', description: 'Adjust inventory' },
  { code: 'REPORT_VIEW', description: 'View reports' },
  { code: 'REPORT_EXPORT', description: 'Export reports' },
  { code: 'DASHBOARD_VIEW', description: 'View dashboard metrics' },
  { code: 'USER_CREATE', description: 'Create users' },
  { code: 'USER_UPDATE', description: 'Update users' },
  { code: 'USER_VIEW', description: 'View users' },
  { code: 'AUDIT_VIEW', description: 'View audit logs' },
];

const ROLE_PERMISSIONS: Record<string, string[] | '*'> = {
  SUPER_ADMIN: '*',
  ADMIN: '*',
  MANAGER: [
    'PRODUCT_CREATE',
    'PRODUCT_VIEW',
    'PRODUCT_UPDATE',
    'CATEGORY_VIEW',
    'LOCATION_VIEW',
    'STOCK_IN_CREATE',
    'STOCK_IN_VIEW',
    'STOCK_OUT_CREATE',
    'STOCK_OUT_VIEW',
    'SALE_CREATE',
    'SALE_VIEW',
    'TRANSFER_CREATE',
    'TRANSFER_VIEW',
    'TRANSFER_DISPATCH',
    'TRANSFER_RECEIVE',
    'TRANSFER_CANCEL',
    'INVENTORY_VIEW',
    'REPORT_VIEW',
    'REPORT_EXPORT',
    'DASHBOARD_VIEW',
    'USER_VIEW',
    'AUDIT_VIEW',
  ],
  STOREKEEPER: [
    'PRODUCT_VIEW',
    'CATEGORY_VIEW',
    'LOCATION_VIEW',
    'STOCK_IN_CREATE',
    'STOCK_IN_VIEW',
    'STOCK_OUT_CREATE',
    'STOCK_OUT_VIEW',
    'SALE_CREATE',
    'SALE_VIEW',
    'TRANSFER_CREATE',
    'TRANSFER_VIEW',
    'INVENTORY_VIEW',
    'DASHBOARD_VIEW',
  ],
  RECEIVER: ['TRANSFER_VIEW', 'TRANSFER_RECEIVE', 'INVENTORY_VIEW'],
};

async function main() {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { description: permission.description },
      create: permission,
    });
  }

  const allPermissions = await prisma.permission.findMany();
  const permissionByCode = new Map(allPermissions.map((p) => [p.code, p]));

  const roles = [
    { name: 'SUPER_ADMIN', description: 'Full system access', isSystem: true },
    { name: 'ADMIN', description: 'Administrative access', isSystem: true },
    { name: 'MANAGER', description: 'Operations manager', isSystem: true },
    { name: 'STOREKEEPER', description: 'Warehouse / store operations', isSystem: true },
    { name: 'RECEIVER', description: 'Regional receiving', isSystem: true },
  ];

  for (const roleDef of roles) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: { description: roleDef.description },
      create: roleDef,
    });

    const allowed = ROLE_PERMISSIONS[roleDef.name];
    const codes = allowed === '*' ? PERMISSIONS.map((p) => p.code) : allowed;

    for (const code of codes) {
      const permission = permissionByCode.get(code);
      if (!permission) continue;
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId: permission.id },
        },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  const categories = [
    { name: 'Air Conditioner', code: 'AC', description: 'Split, cassette, and packaged AC units' },
    { name: 'Compressor', code: 'COMP', description: 'Hermetic and semi-hermetic compressors' },
    { name: 'Refrigeration Equipment', code: 'REF', description: 'Commercial refrigeration equipment' },
    { name: 'Spare Part', code: 'SPARE', description: 'Service and spare parts' },
    { name: 'Refrigerant', code: 'GAS', description: 'Refrigerant gases and cylinders' },
    { name: 'Other', code: 'OTHER', description: 'Uncategorized items' },
  ];

  const categoryRecords: Record<string, string> = {};
  for (const category of categories) {
    const row = await prisma.category.upsert({
      where: { code: category.code },
      update: { name: category.name, description: category.description },
      create: category,
    });
    categoryRecords[category.code] = row.id;
  }

  const locations = [
    { name: 'Addis Ababa', code: 'ADDIS', address: 'Addis Ababa, Ethiopia', contactPerson: 'Head Store' },
    { name: 'Mekele', code: 'MEKELE', address: 'Mekele, Tigray, Ethiopia' },
    { name: 'Bahir Dar', code: 'BAHIR_DAR', address: 'Bahir Dar, Amhara, Ethiopia' },
    { name: 'Hawassa', code: 'HAWASSA', address: 'Hawassa, Sidama, Ethiopia' },
  ];

  for (const location of locations) {
    await prisma.location.upsert({
      where: { code: location.code },
      update: { name: location.name, address: location.address },
      create: location,
    });
  }

  const reasons = [
    { name: 'Regional Stock Transfer', code: 'REGIONAL_STOCK_TRANSFER' },
    { name: 'Maintenance', code: 'MAINTENANCE' },
    { name: 'Installation', code: 'INSTALLATION' },
    { name: 'Service', code: 'SERVICE' },
    { name: 'Replacement', code: 'REPLACEMENT' },
    { name: 'Other', code: 'OTHER' },
  ];

  for (const reason of reasons) {
    await prisma.transferReason.upsert({
      where: { code: reason.code },
      update: { name: reason.name },
      create: reason,
    });
  }

  await prisma.product.upsert({
    where: { bcNumber: '001' },
    update: {},
    create: {
      bcNumber: '001',
      itemName: 'Compressor',
      model: 'TL4G',
      unit: 'PCS',
      brand: 'SECOF',
      description: 'Sample compressor used for development',
      isSerialized: true,
      categoryId: categoryRecords.COMP,
    },
  });

  await prisma.product.upsert({
    where: { bcNumber: '002' },
    update: {},
    create: {
      bcNumber: '002',
      itemName: 'Split Air Conditioner',
      model: '24K',
      unit: 'PCS',
      brand: 'SWK',
      description: 'Sample split AC',
      isSerialized: true,
      categoryId: categoryRecords.AC,
    },
  });

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'ADMIN' },
  });
  const storekeeperRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'STOREKEEPER' },
  });

  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@swk.local';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@SWK2026!';
  const passwordHash = await argon2.hash(password);

  await prisma.user.upsert({
    where: { email },
    update: {
      firstName: process.env.SEED_ADMIN_FIRST_NAME ?? 'System',
      lastName: process.env.SEED_ADMIN_LAST_NAME ?? 'Administrator',
      roleId: adminRole.id,
      isActive: true,
    },
    create: {
      email,
      passwordHash,
      firstName: process.env.SEED_ADMIN_FIRST_NAME ?? 'System',
      lastName: process.env.SEED_ADMIN_LAST_NAME ?? 'Administrator',
      roleId: adminRole.id,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'storekeeper@swk.local' },
    update: {
      firstName: 'Amanuel',
      lastName: 'Store',
      roleId: storekeeperRole.id,
      isActive: true,
    },
    create: {
      email: 'storekeeper@swk.local',
      passwordHash: await argon2.hash('Store@SWK2026!'),
      firstName: 'Amanuel',
      lastName: 'Store',
      roleId: storekeeperRole.id,
      isActive: true,
    },
  });

  console.log('Seed complete.');
  console.log(`ADMIN: ${email}`);
  console.log('STOREKEEPER: storekeeper@swk.local');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
