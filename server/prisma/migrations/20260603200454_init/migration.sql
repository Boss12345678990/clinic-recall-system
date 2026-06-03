-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ContactStep" AS ENUM ('NOT_STARTED', 'LINE_SENT', 'CALL_1', 'CALL_2', 'CALL_3');

-- CreateEnum
CREATE TYPE "ConfirmStatus" AS ENUM ('CONFIRMED', 'UNCONFIRMED');

-- CreateEnum
CREATE TYPE "ClosedReason" AS ENUM ('CONFIRMED_BOOKED', 'NO_RESPONSE', 'MANUAL');

-- CreateEnum
CREATE TYPE "CallOutcome" AS ENUM ('NO_ANSWER', 'REACHED');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "birthday" DATE,
    "lastVisit" DATE,
    "intervalMonths" INTEGER NOT NULL DEFAULT 6,
    "lineUserId" TEXT,
    "status" "PatientStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "visitDate" DATE NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecallCycle" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "recallDate" DATE NOT NULL,
    "step" "ContactStep" NOT NULL DEFAULT 'NOT_STARTED',
    "status" "ConfirmStatus" NOT NULL DEFAULT 'UNCONFIRMED',
    "lineSentAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "closedReason" "ClosedReason",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecallCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallLog" (
    "id" SERIAL NOT NULL,
    "cycleId" INTEGER NOT NULL,
    "patientId" INTEGER NOT NULL,
    "userId" INTEGER,
    "attemptNo" INTEGER NOT NULL,
    "outcome" "CallOutcome" NOT NULL DEFAULT 'NO_ANSWER',
    "note" TEXT,
    "calledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_lineUserId_key" ON "Patient"("lineUserId");

-- CreateIndex
CREATE INDEX "RecallCycle_recallDate_idx" ON "RecallCycle"("recallDate");

-- CreateIndex
CREATE INDEX "RecallCycle_isActive_step_status_idx" ON "RecallCycle"("isActive", "step", "status");

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecallCycle" ADD CONSTRAINT "RecallCycle_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "RecallCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
