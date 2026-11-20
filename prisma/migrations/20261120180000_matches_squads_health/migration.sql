-- AlterTable
ALTER TABLE "Student" ADD COLUMN "bloodGroup" TEXT;
ALTER TABLE "Student" ADD COLUMN "emergencyName" TEXT;
ALTER TABLE "Student" ADD COLUMN "emergencyPhone" TEXT;
ALTER TABLE "Student" ADD COLUMN "medicalNotes" TEXT;

-- CreateTable
CREATE TABLE "TournamentSquad" (
    "tournamentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PLAYER',
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("tournamentId", "studentId"),
    CONSTRAINT "TournamentSquad_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TournamentSquad_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "opponent" TEXT NOT NULL,
    "venue" TEXT,
    "matchType" TEXT NOT NULL DEFAULT 'FRIENDLY',
    "overs" INTEGER,
    "result" TEXT,
    "ourScore" TEXT,
    "opponentScore" TEXT,
    "notes" TEXT,
    "tournamentId" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerMatchStat" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "batted" BOOLEAN NOT NULL DEFAULT false,
    "notOut" BOOLEAN NOT NULL DEFAULT false,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "balls" INTEGER NOT NULL DEFAULT 0,
    "fours" INTEGER NOT NULL DEFAULT 0,
    "sixes" INTEGER NOT NULL DEFAULT 0,
    "ballsBowled" INTEGER NOT NULL DEFAULT 0,
    "maidens" INTEGER NOT NULL DEFAULT 0,
    "runsConceded" INTEGER NOT NULL DEFAULT 0,
    "wickets" INTEGER NOT NULL DEFAULT 0,
    "catches" INTEGER NOT NULL DEFAULT 0,
    "stumpings" INTEGER NOT NULL DEFAULT 0,
    "runOuts" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PlayerMatchStat_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayerMatchStat_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TournamentSquad_studentId_idx" ON "TournamentSquad"("studentId");

-- CreateIndex
CREATE INDEX "Match_date_idx" ON "Match"("date");

-- CreateIndex
CREATE INDEX "PlayerMatchStat_studentId_idx" ON "PlayerMatchStat"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerMatchStat_matchId_studentId_key" ON "PlayerMatchStat"("matchId", "studentId");

