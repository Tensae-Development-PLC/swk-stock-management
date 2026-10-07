import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb('SWK inventory e2e', () => {
  let app: INestApplication;
  let token: string;
  let productId: string;
  let addisId: string;
  let mekeleId: string;
  let reasonId: string;
  let receivingToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs in as SUPER_ADMIN', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: process.env.SEED_ADMIN_EMAIL ?? 'admin@swk.local',
        password: process.env.SEED_ADMIN_PASSWORD ?? 'Admin@SWK2026!',
      })
      .expect(201);
    token = res.body.data.accessToken;
    expect(token).toBeDefined();
  });

  it('rejects invalid login', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@swk.local', password: 'wrong-password' })
      .expect(401);
  });

  it('loads master data', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const products = await request(app.getHttpServer()).get('/api/products').set(auth).expect(200);
    const locations = await request(app.getHttpServer()).get('/api/locations').set(auth).expect(200);
    const reasons = await request(app.getHttpServer())
      .get('/api/transfers/reasons')
      .set(auth)
      .expect(200);
    productId = products.body.data.find((p: { bcNumber: string }) => p.bcNumber === '001').id;
    addisId = locations.body.data.find((l: { code: string }) => l.code === 'ADDIS').id;
    mekeleId = locations.body.data.find((l: { code: string }) => l.code === 'MEKELE').id;
    reasonId = reasons.body.data.find((r: { code: string }) => r.code === 'MAINTENANCE').id;
  });

  it('performs serialized stock-in', async () => {
    const suffix = Date.now().toString().slice(-6);
    const res = await request(app.getHttpServer())
      .post('/api/stock-in')
      .set({ Authorization: `Bearer ${token}` })
      .send({
        productId,
        locationId: addisId,
        quantity: 3,
        totalCost: 150000,
        purchaseDate: '2026-08-28',
        serials: [
          { serialNumber: `E2E${suffix}A` },
          { serialNumber: `E2E${suffix}B` },
          { serialNumber: `E2E${suffix}C` },
        ],
      })
      .expect(201);
    expect(res.body.data.items).toHaveLength(3);
    expect(res.body.data.unitCost).toBe('50000.00');
  });

  it('rejects duplicate serial on stock-in', async () => {
    const suffix = `DUP${Date.now().toString().slice(-5)}`;
    const payload = {
      productId,
      locationId: addisId,
      quantity: 1,
      totalCost: 50000,
      purchaseDate: '2026-08-28',
      serials: [{ serialNumber: suffix }],
    };
    await request(app.getHttpServer())
      .post('/api/stock-in')
      .set({ Authorization: `Bearer ${token}` })
      .send(payload)
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/stock-in')
      .set({ Authorization: `Bearer ${token}` })
      .send(payload)
      .expect(409);
  });

  it('performs direct sale and preserves purchase cost', async () => {
    const serial = `SALE${Date.now().toString().slice(-6)}`;
    await request(app.getHttpServer())
      .post('/api/stock-in')
      .set({ Authorization: `Bearer ${token}` })
      .send({
        productId,
        locationId: addisId,
        quantity: 1,
        totalCost: 50000,
        purchaseDate: '2026-08-28',
        serials: [{ serialNumber: serial }],
      })
      .expect(201);

    const sale = await request(app.getHttpServer())
      .post('/api/sales')
      .set({ Authorization: `Bearer ${token}` })
      .send({
        locationId: addisId,
        saleDate: '2026-08-30',
        items: [{ serialNumber: serial, sellingPrice: 65000 }],
      })
      .expect(201);

    expect(sale.body.data.items[0].purchasePrice).toBe('50000.00');
    expect(sale.body.data.items[0].sellingPrice).toBe('65000.00');
    expect(sale.body.data.items[0].profit).toBe('15000.00');
  });

  it('creates a transfer, rejects wrong serial, accepts matching serial', async () => {
    const serial = `TRN${Date.now().toString().slice(-6)}`;
    await request(app.getHttpServer())
      .post('/api/stock-in')
      .set({ Authorization: `Bearer ${token}` })
      .send({
        productId,
        locationId: addisId,
        quantity: 1,
        totalCost: 50000,
        purchaseDate: '2026-08-28',
        serials: [{ serialNumber: serial }],
      })
      .expect(201);

    const transfer = await request(app.getHttpServer())
      .post('/api/transfers')
      .set({ Authorization: `Bearer ${token}` })
      .send({
        sourceLocationId: addisId,
        destinationLocationId: mekeleId,
        reasonId,
        receiverName: 'Binyam',
        serialNumbers: [serial],
      })
      .expect(201);

    receivingToken = transfer.body.data.receivingToken;
    expect(receivingToken).toBeDefined();
    expect(transfer.body.data.status).toBe('AWAITING_RECEIPT');

    await request(app.getHttpServer())
      .post(`/api/receiving/${receivingToken}/verify`)
      .send({ serialNumber: 'WRONG-SERIAL' })
      .expect(422);

    const stillPending = await request(app.getHttpServer())
      .get(`/api/transfers/${transfer.body.data.id}`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    expect(stillPending.body.data.status).toBe('AWAITING_RECEIPT');

    await request(app.getHttpServer())
      .post(`/api/receiving/${receivingToken}/verify`)
      .send({ serialNumber: serial })
      .expect(201);

    const received = await request(app.getHttpServer())
      .get(`/api/transfers/${transfer.body.data.id}`)
      .set({ Authorization: `Bearer ${token}` })
      .expect(200);
    expect(received.body.data.status).toBe('RECEIVED');

    await request(app.getHttpServer())
      .post(`/api/receiving/${receivingToken}/verify`)
      .send({ serialNumber: serial })
      .expect(409);
  });
});
