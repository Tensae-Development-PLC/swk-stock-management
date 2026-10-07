# SWK-HVACR Stock Management API

Serialized inventory backend for SWK-HVACR (Ethiopia). Phase 1 is the PostgreSQL/Prisma schema. Phase 2 is this NestJS REST API. The Next.js frontend is **not** part of this phase.

Barcode/QR scanning happens on a future client. This API accepts the **decoded serial number** and validates it.

Swagger UI: `http://localhost:3000/api/docs`

## Architecture (short)

- **Product** = catalog (BC number, name, model, unit, category).
- **InventoryUnit** = one physical item with a globally unique serial number.
- **StockMovement** = immutable ledger. Never deleted.
- **Transfer + TransferReceiptToken** = regional dispatch with a hashed public receiving token (no database IDs in the URL).
- Money is **ETB** stored as `NUMERIC(18,2)`. Application math uses `decimal.js`.

Full design: [`docs/DATABASE_ARCHITECTURE.md`](docs/DATABASE_ARCHITECTURE.md)

## Prerequisites

- Node.js 20+
PostgreSQL is published on **5433** by default so it does not clash with a local Postgres on 5432.

## Setup

```bash
cd backend
copy .env.example .env
docker compose up -d postgres
npm install
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
```

Open:

- API: http://localhost:3000/api/health
- Swagger: http://localhost:3000/api/docs

### Development seed login

These are **not** real client credentials.

- Email: `admin@swk.local`
- Password: `Admin@SWK2026!`

Authorize in Swagger with `Bearer <accessToken>` after `POST /api/auth/login`.

## Docker (API + PostgreSQL)

```bash
cd backend
copy .env.example .env
docker compose up --build
```

## Core workflows

### Stock in (serialized)

`POST /api/stock-in`

Quantity must equal the number of scanned serials. The whole batch is one database transaction.

### Direct sale

`POST /api/sales` or `POST /api/stock-out` with `method: DIRECT_SALE`

Selling price is stored separately. Purchase cost is never overwritten. Profit = selling price − purchase cost.

### Regional transfer + receiver verification

1. `POST /api/transfers` — returns `receivingToken` and `receivingUrl` **once**.
2. Receiver opens `GET /api/receiving/{token}`.
3. Receiver submits scanned serial: `POST /api/receiving/{token}/verify`.
4. Match → unit moves to destination `IN_STOCK`, transfer `RECEIVED`.
5. Mismatch → transfer stays `AWAITING_RECEIPT`, verification log is written.

## Tests

```bash
npm test          # unit tests (money, serials, tokens)
npm run test:e2e  # requires DATABASE_URL and a seeded database
```

## Environment

See `.env.example`. Never commit `.env`. JWT secrets and database passwords must come from the environment.
