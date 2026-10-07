export type ApiSuccess<T> = {
  success: true;
  statusCode: number;
  data: T;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type ApiError = {
  success: false;
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
};

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  permissions: string[];
  isActive: boolean;
};

export type Paginated<T> = {
  items: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

export type Category = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isActive: boolean;
};

export type Product = {
  id: string;
  bcNumber: string;
  itemName: string;
  model: string;
  unit: string;
  brand: string | null;
  description: string | null;
  catalogRemark?: string | null;
  isSerialized: boolean;
  isActive: boolean;
  categoryId: string;
  category?: Category;
  _count?: { inventoryUnits: number };
  availableUnits?: number;
  serializedAvailable?: number;
  openingBalance?: number;
  totalUnits?: number;
  createdAt: string;
  updatedAt: string;
};

export type Location = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  contactPerson: string | null;
  phone: string | null;
  isActive: boolean;
};

export type InventoryUnit = {
  id: string;
  serialNumber: string;
  purchasePrice: string;
  purchaseDate: string;
  status: string;
  remark: string | null;
  currentLocationId: string;
  productId: string;
  product?: Product;
  currentLocation?: Location;
  movements?: StockMovement[];
  createdAt: string;
  updatedAt: string;
};

export type StockMovement = {
  id: string;
  movementType: string;
  quantity: number;
  purchasePrice: string | null;
  sellingPrice: string | null;
  referenceNumber: string;
  notes: string | null;
  createdAt: string;
  product?: { itemName: string; model: string };
  inventoryUnit?: { serialNumber: string };
  sourceLocation?: Location | null;
  destinationLocation?: Location | null;
  performedBy?: { firstName: string; lastName: string; email: string } | null;
};

export type DashboardSummary = {
  period: string;
  totalProducts: number;
  totalSerializedUnits: number;
  availableStock: number;
  soldUnits: number;
  dispatchedUnits: number;
  pendingReceipts: number;
  receivedTransfers: number;
  maintenanceUnits: number;
  failedVerifications: number;
  stockValue: string;
  availableStockValue: string;
  salesRevenue: string;
  salesPurchaseCost: string;
  estimatedProfit: string;
  stockByRegion: {
    locationId: string;
    name: string;
    code: string;
    available: number;
    dispatched: number;
    total: number;
    stockValue: string;
  }[];
  stockByCategory: {
    categoryId: string;
    name: string;
    code: string;
    units: number;
    stockValue: string;
  }[];
  topProducts: {
    productId: string;
    itemName: string;
    model: string;
    bcNumber: string;
    units: number;
    stockValue: string;
  }[];
  movementSeries: { date: string; stockIn: number; stockOut: number }[];
  recentStockMovements: StockMovement[];
  recentInventory: {
    id: string;
    serialNumber: string;
    status: string;
    purchasePrice: string;
    product?: { itemName: string; model: string; bcNumber: string };
    currentLocation?: { name: string; code: string };
    lastMovement: { movementType: string; createdAt: string } | null;
  }[];
  currency: string;
};

export type TransferReason = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
};

export type TransferItem = {
  id: string;
  expectedSerialNumber: string;
  scannedSerialNumber: string | null;
  status: string;
  receivedAt: string | null;
  product?: Product;
  inventoryUnit?: InventoryUnit;
};

export type TransferFieldEvent = {
  id: string;
  serialNumber: string;
  lat: number;
  lng: number;
  accuracyM: number | null;
  notes: string | null;
  performedByName: string;
  performedByPhone: string;
  createdAt: string;
  hasPhoto?: boolean;
  photoUrl?: string;
};

export type Transfer = {
  id: string;
  referenceNumber: string;
  status: string;
  receiverName: string;
  receiverPhone: string | null;
  stockYear?: number;
  fsNumber?: string;
  dispatchDate: string | null;
  receivedAt: string | null;
  receivedLat?: number | null;
  receivedLng?: number | null;
  receivedAccuracyM?: number | null;
  notes: string | null;
  sourceLocation?: Location;
  destinationLocation?: Location;
  reason?: TransferReason;
  items?: TransferItem[];
  fieldEvents?: TransferFieldEvent[];
  receivingToken?: string;
  receivingUrl?: string;
  receivingLinkActive?: boolean;
  receivingLinkDisabled?: boolean;
  maintenanceToken?: string;
  maintenanceUrl?: string;
  maintenanceLinkActive?: boolean;
  maintenanceLinkLocked?: boolean;
  maintenanceVisitCount?: number;
  lifecycleStage?: string;
  _count?: { fieldEvents?: number };
  createdAt: string;
  verificationLogs?: {
    id: string;
    result: string;
    expectedSerialNumber: string | null;
    scannedSerialNumber: string | null;
    attemptedAt: string;
  }[];
};

export type StaffNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  entity: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
};

export type SaleItem = {
  id: string;
  serialNumber: string;
  purchasePrice: string;
  sellingPrice: string;
  profit: string;
  product?: Product;
};

export type Sale = {
  id: string;
  referenceNumber: string;
  saleDate: string;
  stockYear?: number;
  fsNumber?: string;
  notes: string | null;
  location?: Location;
  items?: SaleItem[];
  performedBy?: { firstName: string; lastName: string; email: string };
  createdAt: string;
};

export type StaffUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  role: { id: string; name: string; description: string | null };
};

export type Role = {
  id: string;
  name: string;
  description: string | null;
  permissions: { permission: { code: string } }[];
};

export type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  ipAddress: string | null;
  createdAt: string;
  user?: { email: string; firstName: string; lastName: string } | null;
};

export type ReceivePreview = {
  message: string;
  referenceNumber: string;
  status: string;
  receiverName: string;
  destination: string;
  source: string;
  reason: string;
  dispatchDate: string | null;
  purpose?: "RECEIVE" | "MAINTENANCE";
  items: {
    itemName: string;
    model: string;
    unit: string;
    brand: string | null;
    serialNumber: string;
    receiptStatus: string;
  }[];
};
