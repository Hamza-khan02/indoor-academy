-- AlterTable
ALTER TABLE "Branch" ADD COLUMN "facilities" TEXT;

-- CreateTable
CREATE TABLE "BranchPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branchId" TEXT NOT NULL,
    "data" BLOB NOT NULL,
    "mimeType" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BranchPhoto_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BranchPhoto_branchId_idx" ON "BranchPhoto"("branchId");

