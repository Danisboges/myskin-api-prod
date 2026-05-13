-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'pending', 'suspended', 'inactive');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE_USER', 'UPDATE_USER', 'DELETE_USER', 'CHANGE_USER_ROLE', 'CHANGE_USER_STATUS', 'RESET_PASSWORD', 'APPROVE_DOCTOR', 'REJECT_DOCTOR', 'UPDATE_SYSTEM_SETTINGS', 'GENERATE_REPORT');

-- CreateEnum
CREATE TYPE "LogSeverity" AS ENUM ('critical', 'warning', 'info');

-- CreateEnum
CREATE TYPE "LogCategory" AS ENUM ('infrastructure', 'ai_engine', 'user_management', 'security', 'system');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'active';

-- CreateTable
CREATE TABLE "AdminSettings" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "verificationAlerts" BOOLEAN NOT NULL DEFAULT true,
    "dataVisibility" "DataVisibility" NOT NULL DEFAULT 'restricted_clinical_team_only',
    "language" TEXT NOT NULL DEFAULT 'English (US)',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminNotification" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "adminName" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "description" TEXT NOT NULL,
    "targetUserId" TEXT,
    "targetResourceType" TEXT,
    "targetResourceId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'success',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL,
    "logId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "LogSeverity" NOT NULL,
    "category" "LogCategory" NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminSettings_adminId_key" ON "AdminSettings"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminNotification_notificationId_key" ON "AdminNotification"("notificationId");

-- CreateIndex
CREATE INDEX "AdminNotification_adminId_isRead_idx" ON "AdminNotification"("adminId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_auditId_key" ON "AuditLog"("auditId");

-- CreateIndex
CREATE INDEX "AuditLog_adminId_createdAt_idx" ON "AuditLog"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SystemLog_logId_key" ON "SystemLog"("logId");

-- CreateIndex
CREATE INDEX "SystemLog_severity_createdAt_idx" ON "SystemLog"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "SystemLog_category_createdAt_idx" ON "SystemLog"("category", "createdAt");

-- AddForeignKey
ALTER TABLE "AdminSettings" ADD CONSTRAINT "AdminSettings_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNotification" ADD CONSTRAINT "AdminNotification_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
