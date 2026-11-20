-- AlterTable
ALTER TABLE "Student" ADD COLUMN "photoUpdatedAt" DATETIME;

-- CreateTable
CREATE TABLE "StudentPhoto" (
    "studentId" TEXT NOT NULL PRIMARY KEY,
    "data" BLOB NOT NULL,
    "mimeType" TEXT NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentPhoto_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

