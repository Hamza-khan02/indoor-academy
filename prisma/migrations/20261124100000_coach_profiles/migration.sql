-- AlterTable
ALTER TABLE "Coach" ADD COLUMN "achievements" TEXT;
ALTER TABLE "Coach" ADD COLUMN "bio" TEXT;
ALTER TABLE "Coach" ADD COLUMN "coachingSince" INTEGER;
ALTER TABLE "Coach" ADD COLUMN "experience" TEXT;
ALTER TABLE "Coach" ADD COLUMN "facebookUrl" TEXT;
ALTER TABLE "Coach" ADD COLUMN "instagramUrl" TEXT;
ALTER TABLE "Coach" ADD COLUMN "photoUpdatedAt" DATETIME;
ALTER TABLE "Coach" ADD COLUMN "youtubeUrl" TEXT;

-- CreateTable
CREATE TABLE "CoachPhoto" (
    "coachId" TEXT NOT NULL PRIMARY KEY,
    "data" BLOB NOT NULL,
    "mimeType" TEXT NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CoachPhoto_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
