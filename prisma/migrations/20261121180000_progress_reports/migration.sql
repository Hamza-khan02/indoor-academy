-- CreateTable
CREATE TABLE "ProgressComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "author" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProgressComment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ProgressComment_studentId_month_key" ON "ProgressComment"("studentId", "month");

