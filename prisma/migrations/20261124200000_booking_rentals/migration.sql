-- CreateTable
CREATE TABLE "RentalFacility" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "maintenanceNote" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "openTime" INTEGER NOT NULL DEFAULT 360,
    "closeTime" INTEGER NOT NULL DEFAULT 1320,
    "slotMinutes" INTEGER NOT NULL DEFAULT 60,
    "maxSlots" INTEGER NOT NULL DEFAULT 4,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "branchId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RentalFacility_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RentalResource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facilityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "maintenanceNote" TEXT,
    "speedMin" INTEGER,
    "speedMax" INTEGER,
    "modes" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RentalResource_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "RentalFacility" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RentalPricing" (
    "facilityId" TEXT NOT NULL PRIMARY KEY,
    "unit" TEXT NOT NULL DEFAULT 'PER_HOUR',
    "price" INTEGER NOT NULL DEFAULT 0,
    "studentDiscountPct" INTEGER NOT NULL DEFAULT 0,
    "peakStart" INTEGER,
    "peakEnd" INTEGER,
    "peakSurchargePct" INTEGER NOT NULL DEFAULT 0,
    "weekendSurchargePct" INTEGER NOT NULL DEFAULT 0,
    "securityDeposit" INTEGER NOT NULL DEFAULT 0,
    "cancelFreeHours" INTEGER NOT NULL DEFAULT 24,
    "cancelChargePct" INTEGER NOT NULL DEFAULT 0,
    "updatedBy" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RentalPricing_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "RentalFacility" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RentalPackage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facilityId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'CUSTOM',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "includesNet" BOOLEAN NOT NULL DEFAULT false,
    "includesOperator" BOOLEAN NOT NULL DEFAULT false,
    "includesBalls" BOOLEAN NOT NULL DEFAULT false,
    "netFacilityId" TEXT,
    "pricePerUnit" INTEGER,
    "operatorCharge" INTEGER NOT NULL DEFAULT 0,
    "ballsCharge" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "RentalPackage_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "RentalFacility" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RentalPackage_netFacilityId_fkey" FOREIGN KEY ("netFacilityId") REFERENCES "RentalFacility" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RentalPromo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "percentOff" INTEGER NOT NULL DEFAULT 0,
    "amountOff" INTEGER NOT NULL DEFAULT 0,
    "minAmount" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TEXT,
    "validTo" TEXT,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "facilityId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RentalPromo_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "RentalFacility" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RentalCustomer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneKey" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RentalBooking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'FACILITY',
    "facilityId" TEXT NOT NULL,
    "packageId" TEXT,
    "customerId" TEXT,
    "familyLoginId" TEXT,
    "studentId" TEXT,
    "customerType" TEXT NOT NULL DEFAULT 'OUTSIDE',
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "players" INTEGER,
    "date" TEXT NOT NULL,
    "startMin" INTEGER NOT NULL,
    "endMin" INTEGER NOT NULL,
    "returnDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "extraCharges" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "deposit" INTEGER NOT NULL DEFAULT 0,
    "paid" INTEGER NOT NULL DEFAULT 0,
    "cancelCharge" INTEGER NOT NULL DEFAULT 0,
    "promoCode" TEXT,
    "priceLines" TEXT NOT NULL DEFAULT '[]',
    "paymentMethod" TEXT NOT NULL DEFAULT 'PAY_AT_VENUE',
    "expiresAt" DATETIME,
    "notes" TEXT,
    "staffNotes" TEXT,
    "cancelReason" TEXT,
    "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'ONLINE',
    "createdBy" TEXT,
    "checkedInAt" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RentalBooking_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "RentalFacility" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RentalBooking_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "RentalPackage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RentalBooking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "RentalCustomer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RentalBooking_familyLoginId_fkey" FOREIGN KEY ("familyLoginId") REFERENCES "FamilyLogin" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RentalBooking_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BookingResource" (
    "bookingId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PRIMARY',

    PRIMARY KEY ("bookingId", "resourceId"),
    CONSTRAINT "BookingResource_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "RentalBooking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookingResource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "RentalResource" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResourceSlot" (
    "resourceId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "block" INTEGER NOT NULL,
    "bookingId" TEXT NOT NULL,

    PRIMARY KEY ("resourceId", "date", "block"),
    CONSTRAINT "ResourceSlot_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "RentalResource" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResourceSlot_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "RentalBooking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FacilityBlockout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "facilityId" TEXT NOT NULL,
    "resourceId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'BLOCKED',
    "fromDate" TEXT NOT NULL,
    "toDate" TEXT NOT NULL,
    "startMin" INTEGER,
    "endMin" INTEGER,
    "reason" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FacilityBlockout_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "RentalFacility" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FacilityBlockout_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "RentalResource" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquipmentItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "totalQty" INTEGER NOT NULL DEFAULT 0,
    "damagedQty" INTEGER NOT NULL DEFAULT 0,
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "rentalPrice" INTEGER NOT NULL DEFAULT 0,
    "priceUnit" TEXT NOT NULL DEFAULT 'PER_ITEM',
    "replacementCost" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "BookingEquipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RESERVED',
    "dueDate" TEXT,
    "issuedAt" DATETIME,
    "returnedAt" DATETIME,
    "inspectedAt" DATETIME,
    "damagedQty" INTEGER NOT NULL DEFAULT 0,
    "missingQty" INTEGER NOT NULL DEFAULT 0,
    "charge" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    CONSTRAINT "BookingEquipment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "RentalBooking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BookingEquipment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "EquipmentItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquipmentMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "bookingId" TEXT,
    "type" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "note" TEXT,
    "actor" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EquipmentMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "EquipmentItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RentalPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "reference" TEXT,
    "gateway" TEXT,
    "gatewayOrderId" TEXT,
    "gatewayPaymentId" TEXT,
    "receiptNo" TEXT,
    "recordedBy" TEXT,
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RentalPayment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "RentalBooking" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RentalRefund" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "paymentId" TEXT,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "method" TEXT,
    "reference" TEXT,
    "gatewayRefundId" TEXT,
    "requestedBy" TEXT,
    "processedBy" TEXT,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RentalRefund_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "RentalBooking" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RentalRefund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "RentalPayment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RentalAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "actorType" TEXT NOT NULL,
    "actorName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RentalAuditLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "RentalBooking" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RentalNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "dedupeKey" TEXT,
    "bookingId" TEXT,
    "customerId" TEXT,
    "familyLoginId" TEXT,
    "emailTo" TEXT,
    "emailStatus" TEXT NOT NULL DEFAULT 'NONE',
    "emailError" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RentalNotification_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "RentalBooking" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RentalNotification_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "RentalCustomer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RentalNotification_familyLoginId_fkey" FOREIGN KEY ("familyLoginId") REFERENCES "FamilyLogin" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RentalFacility_category_idx" ON "RentalFacility"("category");

-- CreateIndex
CREATE UNIQUE INDEX "RentalResource_code_key" ON "RentalResource"("code");

-- CreateIndex
CREATE INDEX "RentalResource_facilityId_idx" ON "RentalResource"("facilityId");

-- CreateIndex
CREATE INDEX "RentalPackage_facilityId_idx" ON "RentalPackage"("facilityId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalPromo_code_key" ON "RentalPromo"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RentalCustomer_phoneKey_key" ON "RentalCustomer"("phoneKey");

-- CreateIndex
CREATE UNIQUE INDEX "RentalBooking_code_key" ON "RentalBooking"("code");

-- CreateIndex
CREATE INDEX "RentalBooking_date_idx" ON "RentalBooking"("date");

-- CreateIndex
CREATE INDEX "RentalBooking_status_idx" ON "RentalBooking"("status");

-- CreateIndex
CREATE INDEX "RentalBooking_facilityId_date_idx" ON "RentalBooking"("facilityId", "date");

-- CreateIndex
CREATE INDEX "RentalBooking_customerId_idx" ON "RentalBooking"("customerId");

-- CreateIndex
CREATE INDEX "RentalBooking_familyLoginId_idx" ON "RentalBooking"("familyLoginId");

-- CreateIndex
CREATE INDEX "RentalBooking_studentId_idx" ON "RentalBooking"("studentId");

-- CreateIndex
CREATE INDEX "RentalBooking_expiresAt_idx" ON "RentalBooking"("expiresAt");

-- CreateIndex
CREATE INDEX "BookingResource_resourceId_idx" ON "BookingResource"("resourceId");

-- CreateIndex
CREATE INDEX "ResourceSlot_bookingId_idx" ON "ResourceSlot"("bookingId");

-- CreateIndex
CREATE INDEX "FacilityBlockout_facilityId_fromDate_toDate_idx" ON "FacilityBlockout"("facilityId", "fromDate", "toDate");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentItem_code_key" ON "EquipmentItem"("code");

-- CreateIndex
CREATE INDEX "BookingEquipment_bookingId_idx" ON "BookingEquipment"("bookingId");

-- CreateIndex
CREATE INDEX "BookingEquipment_itemId_status_idx" ON "BookingEquipment"("itemId", "status");

-- CreateIndex
CREATE INDEX "EquipmentMovement_itemId_createdAt_idx" ON "EquipmentMovement"("itemId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RentalPayment_gatewayOrderId_key" ON "RentalPayment"("gatewayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalPayment_gatewayPaymentId_key" ON "RentalPayment"("gatewayPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalPayment_receiptNo_key" ON "RentalPayment"("receiptNo");

-- CreateIndex
CREATE INDEX "RentalPayment_bookingId_idx" ON "RentalPayment"("bookingId");

-- CreateIndex
CREATE INDEX "RentalPayment_paidAt_idx" ON "RentalPayment"("paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "RentalRefund_gatewayRefundId_key" ON "RentalRefund"("gatewayRefundId");

-- CreateIndex
CREATE INDEX "RentalRefund_bookingId_idx" ON "RentalRefund"("bookingId");

-- CreateIndex
CREATE INDEX "RentalRefund_status_idx" ON "RentalRefund"("status");

-- CreateIndex
CREATE INDEX "RentalAuditLog_bookingId_idx" ON "RentalAuditLog"("bookingId");

-- CreateIndex
CREATE INDEX "RentalAuditLog_createdAt_idx" ON "RentalAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "RentalAuditLog_entity_entityId_idx" ON "RentalAuditLog"("entity", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalNotification_dedupeKey_key" ON "RentalNotification"("dedupeKey");

-- CreateIndex
CREATE INDEX "RentalNotification_customerId_createdAt_idx" ON "RentalNotification"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "RentalNotification_familyLoginId_createdAt_idx" ON "RentalNotification"("familyLoginId", "createdAt");

-- CreateIndex
CREATE INDEX "RentalNotification_bookingId_idx" ON "RentalNotification"("bookingId");

