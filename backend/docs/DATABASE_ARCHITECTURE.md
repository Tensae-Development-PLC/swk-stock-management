# SWK-HVACR Stock Management — Database Architecture

This document is the Phase 1 design for the serialized inventory system.
The barcode/QR scanner lives in a future frontend. The backend only receives
and validates decoded serial numbers.

## 1. Complete entity list

### Identity and access

| Entity | Purpose |
| --- | --- |
| `User` | Staff accounts. Passwords stored as Argon2 hashes. |
| `Role` | Expandable roles (SUPER_ADMIN, ADMIN, MANAGER, STOREKEEPER, RECEIVER). |
| `Permission` | Expandable permission codes (PRODUCT_CREATE, STOCK_IN_CREATE, …). |
| `RolePermission` | Many-to-many mapping of roles to permissions. |
| `RefreshToken` | Hashed refresh tokens so logout can revoke sessions. |

### Product master

| Entity | Purpose |
| --- | --- |
| `Category` | Expandable product categories (not a hard-coded enum). |
| `Product` | What the item is: BC number, name, model, unit, brand. Not a physical unit. |

### Locations

| Entity | Purpose |
| --- | --- |
| `Location` | Warehouses / regions. Administrators can add any region. |

### Inventory

| Entity | Purpose |
| --- | --- |
| `InventoryUnit` | One physical serialized item. Unique serial number. Current status and location. |
| `InventoryBalance` | Quantity-by-location for non-serialized products (refrigerant, bulk parts). |
| `StockMovement` | Immutable ledger of every movement. Never deleted. |

### Stock In

| Entity | Purpose |
| --- | --- |
| `StockInBatch` | One receiving transaction: product, qty, total cost, location, date. |
| `StockInItem` | Each scanned serial in that batch, with per-unit purchase cost. |

### Sales (Stock Out method 1)

| Entity | Purpose |
| --- | --- |
| `Sale` | Direct-sale header. |
| `SaleItem` | One sold inventory unit with selling price and preserved purchase cost. |

### Transfers (Stock Out method 2)

| Entity | Purpose |
| --- | --- |
| `TransferReason` | Expandable reasons (Regional Stock Transfer, Maintenance, …). |
| `Transfer` | Header: source, destination, receiver, status. Supports multiple units. |
| `TransferItem` | Each inventory unit on a transfer, with expected serial snapshot. |
| `TransferReceiptToken` | Secure public receiving token. Only the hash is stored. |
| `VerificationLog` | Every receive-scan attempt (match, mismatch, expired, …). Append-only. |

### Operations and reporting

| Entity | Purpose |
| --- | --- |
| `AuditLog` | Who did what, on which entity, with old/new values. Append-only. |
| `DocumentSequence` | Yearly counters for human-readable refs (SI-2026-0001, TR-2026-0001). |

## 2. Entity explanations

### Product vs InventoryUnit (mandatory distinction)

- **Product** describes a catalog item: “Compressor / TL4G / PCS”.
- **InventoryUnit** is one physical box: serial `TL4G-001`, currently IN_STOCK in Addis.
- Quantity on a product is never the source of truth for serialized goods.
- Available quantity is always `COUNT(InventoryUnit WHERE status IN available states AND location = …)`.

### StockInBatch

Captures the spreadsheet-style receiving row: quantity, total purchase cost,
purchase date, location, remark. Unit cost = totalCost / quantity using
`NUMERIC` arithmetic (never IEEE floats). Individual items may override unit cost.

### StockMovement

Every state change writes a ledger row. Current `InventoryUnit.status` and
`currentLocationId` are updated in the same database transaction as the ledger
insert. Reports read the ledger; the unit row is a fast current snapshot.

### Transfer + TransferItem

One transfer can contain many serialized units even if today’s process usually
sends one. Receipt is complete only when every item is verified.

### TransferReceiptToken

Public URL uses a cryptographically random token, not a database id.
The database stores `tokenHash` (SHA-256), `expiresAt`, `usedAt`, and status.

## 3. Relationships

```
Role 1──* User
Role *──* Permission          (via RolePermission)
User 1──* RefreshToken
User 1──* AuditLog
User 1──* StockMovement       (performedBy)
User 1──* StockInBatch
User 1──* Sale
User 1──* Transfer            (createdBy / dispatchedBy)

Category 1──* Product
Product  1──* InventoryUnit
Product  1──* StockMovement
Product  1──* StockInBatch
Product  1──* InventoryBalance

Location 1──* InventoryUnit   (currentLocation)
Location 1──* InventoryBalance
Location 1──* StockInBatch
Location 1──* Transfer        (source and destination)
Location 1──* StockMovement   (source and destination)

StockInBatch 1──* StockInItem
StockInItem  1──1 InventoryUnit   (optional back-reference)

InventoryUnit 1──* StockMovement
InventoryUnit 1──* SaleItem
InventoryUnit 1──* TransferItem

Sale 1──* SaleItem
SaleItem ── InventoryUnit (unique among completed sales)

TransferReason 1──* Transfer
Transfer 1──* TransferItem
Transfer 1──* TransferReceiptToken
Transfer 1──* VerificationLog
TransferItem ── InventoryUnit
```

## 4. Important enums

Stored as PostgreSQL enums so invalid values cannot be inserted.

**InventoryStatus:** IN_STOCK, RESERVED, SOLD, DISPATCHED, AWAITING_RECEIPT,
RECEIVED, IN_MAINTENANCE, RETURNED, DAMAGED, LOST

**MovementType:** STOCK_IN, SALE, TRANSFER_OUT, TRANSFER_RECEIVED, RETURN,
MAINTENANCE_OUT, MAINTENANCE_RETURN, ADJUSTMENT

**TransferStatus:** CREATED, DISPATCHED, AWAITING_RECEIPT, RECEIVED,
REJECTED, CANCELLED, EXPIRED

**TransferItemStatus:** PENDING, DISPATCHED, RECEIVED, REJECTED, CANCELLED

**ReceiptTokenStatus:** ACTIVE, USED, EXPIRED, REVOKED

**VerificationResult:** MATCH, MISMATCH, EXPIRED_TOKEN, ALREADY_RECEIVED,
INVALID_TOKEN, ITEM_NOT_ON_TRANSFER

**SaleStatus:** COMPLETED, CANCELLED

**StockInBatchStatus:** COMPLETED, CANCELLED

**StockOutMethod:** DIRECT_SALE, REGIONAL_TRANSFER (application-level)

Categories, transfer reasons, roles, and permissions are **tables**, not enums,
so they can grow without migrations.

## 5. Database constraints

- `Product.bcNumber` UNIQUE
- `InventoryUnit.serialNumber` UNIQUE (global)
- `Location.code` UNIQUE
- `Category.code` UNIQUE, `Category.name` UNIQUE
- `User.email` UNIQUE
- `Role.name` UNIQUE, `Permission.code` UNIQUE
- `InventoryBalance (productId, locationId)` UNIQUE
- `SaleItem.inventoryUnitId` UNIQUE (a unit cannot be sold twice)
- Foreign keys with `ON DELETE RESTRICT` for operational data
- Monetary columns `NUMERIC(18,2)` with CHECK `>= 0`
- `Transfer.sourceLocationId <> destinationLocationId` (CHECK)
- `StockInBatch.quantity > 0`
- `InventoryBalance.quantity >= 0`
- Inventory unit `version` column for optimistic concurrency

## 6. Stock lifecycle (InventoryUnit)

```
            STOCK_IN
                │
                ▼
            IN_STOCK ◄──────────────────────────────┐
               │                                    │
     ┌─────────┼──────────────┐                     │
     ▼         ▼              ▼                     │
   SOLD    DISPATCHED    IN_MAINTENANCE              │
 (SALE)   (TRANSFER_OUT)  (MAINTENANCE_OUT)          │
               │              │                     │
               ▼              └─────────────────────┘
        AWAITING_RECEIPT        MAINTENANCE_RETURN
               │
               ▼
           RECEIVED ──► IN_STOCK at destination
        (TRANSFER_RECEIVED)

Side states: RESERVED, RETURNED, DAMAGED, LOST (ADJUSTMENT / RETURN)
```

- Direct sale: IN_STOCK → SOLD. Purchase cost is never overwritten.
- Transfer dispatch: IN_STOCK → DISPATCHED (in transit). Not available, not at destination yet.
- Transfer receive (match): DISPATCHED → IN_STOCK, `currentLocationId` = destination.
- Transfer receive (mismatch): status stays DISPATCHED. Transfer stays AWAITING_RECEIPT.
- Available stock = IN_STOCK (and RECEIVED if a unit is briefly in that state).
- Company stock value = purchase cost of units not SOLD and not LOST.
- In-transit (DISPATCHED / AWAITING_RECEIPT) counts toward company value, not toward destination available stock. Prevents double-counting.

## 7. Transfer lifecycle

```
CREATED
   │  dispatch
   ▼
DISPATCHED
   │  token issued, units locked
   ▼
AWAITING_RECEIPT
   │
   ├── scan MATCH (all items) ──► RECEIVED
   ├── scan MISMATCH ──► stay AWAITING_RECEIPT + VerificationLog
   ├── cancel ──► CANCELLED (units return IN_STOCK at source)
   ├── reject ──► REJECTED
   └── expiry ──► EXPIRED
```

Mismatch never moves the transfer to RECEIVED.

## 8. Receiver verification lifecycle

1. Manager creates transfer with one or more serials.
2. System generates a 32-byte CSPRNG token, stores SHA-256 hash, returns the raw token once.
3. Public URL shape: `/api/receiving/{token}` (frontend will later use `/receive/{token}`).
4. Receiver opens link → limited payload (item, model, destination, reference, receiver name). No internal UUIDs required by the client.
5. Receiver submits scanned serial.
6. Backend loads transfer by token hash, checks expiry, reuse, and status.
7. Compare scanned serial to expected serial(s) (normalized: trim + uppercase).
8. MATCH: mark item received; if all items received, transfer RECEIVED, token USED, unit location updated, TRANSFER_RECEIVED movement written.
9. MISMATCH: log attempt, return 409/422, leave transfer pending.
10. Rate-limit public endpoints. Token cannot access any other transfer.

## 9. Money

All money is Ethiopian Birr stored as `NUMERIC(18,2)`.
Application math uses `decimal.js` / Prisma `Decimal`, never JavaScript `number` floats.

## 10. Concurrency

Stock mutations run in a single Prisma interactive transaction.
Sales and transfers update units with `UPDATE … WHERE id = $id AND status = 'IN_STOCK'`.
If `count = 0`, the operation fails with a conflict (two clerks cannot sell the same serial).
Optional `version` increment provides extra optimistic locking.

## 11. Edge cases accounted for

- Duplicate serial on stock-in (global unique + pre-check).
- Duplicate serials inside the same batch.
- Serial count ≠ declared quantity.
- Stock-in of an already existing serial.
- Selling a dispatched / sold / damaged unit.
- Transferring to the same location.
- Receiving with the wrong serial.
- Reusing a spent or expired token.
- Receiving after the transfer was already received.
- Inactive location or product.
- Inactive user cannot authenticate.
- Non-serialized products use `InventoryBalance` instead of serial scans.
- Partial transfer receipt (3 units, 1 scanned) — transfer stays AWAITING_RECEIPT until all match.
