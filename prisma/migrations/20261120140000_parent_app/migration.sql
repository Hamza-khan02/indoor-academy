-- AlterTable
ALTER TABLE "Student" ADD COLUMN "guardianPhoneKey" TEXT;

-- CreateTable
CREATE TABLE "FamilyLogin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phoneKey" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    "lastLoginAt" DATETIME,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "FamilyLogin_phoneKey_key" ON "FamilyLogin"("phoneKey");

-- CreateIndex
CREATE INDEX "Student_guardianPhoneKey_idx" ON "Student"("guardianPhoneKey");

