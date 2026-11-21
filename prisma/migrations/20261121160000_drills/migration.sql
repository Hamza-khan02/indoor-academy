-- CreateTable
CREATE TABLE "Drill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "videoUrl" TEXT,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "dueOn" TEXT,
    "batchId" TEXT,
    "createdById" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Drill_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DrillStudent" (
    "drillId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    PRIMARY KEY ("drillId", "studentId"),
    CONSTRAINT "DrillStudent_drillId_fkey" FOREIGN KEY ("drillId") REFERENCES "Drill" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DrillStudent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DrillCompletion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "drillId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "note" TEXT,
    "doneAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DrillCompletion_drillId_fkey" FOREIGN KEY ("drillId") REFERENCES "Drill" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DrillCompletion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Drill_batchId_idx" ON "Drill"("batchId");

-- CreateIndex
CREATE INDEX "DrillStudent_studentId_idx" ON "DrillStudent"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "DrillCompletion_drillId_studentId_key" ON "DrillCompletion"("drillId", "studentId");

