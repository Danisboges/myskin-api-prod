-- Add audit actions used by clinic and clinic-request endpoints.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CREATE_CLINIC';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'UPDATE_CLINIC';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DELETE_CLINIC';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CREATE_CLINIC_REQUEST';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'APPROVE_CLINIC_REQUEST';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REJECT_CLINIC_REQUEST';

-- Create clinic request table.
CREATE TABLE "ClinicRequest" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "clinicName" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "requesterName" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "requesterPhone" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewNote" TEXT,
    "reviewedByAdminId" TEXT,
    "reviewedByAdminName" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "clinicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClinicRequest_requestId_key" ON "ClinicRequest"("requestId");
CREATE INDEX "ClinicRequest_status_createdAt_idx" ON "ClinicRequest"("status", "createdAt");
CREATE INDEX "ClinicRequest_clinicName_idx" ON "ClinicRequest"("clinicName");
CREATE INDEX "ClinicRequest_requesterEmail_idx" ON "ClinicRequest"("requesterEmail");

ALTER TABLE "ClinicRequest"
ADD CONSTRAINT "ClinicRequest_clinicId_fkey"
FOREIGN KEY ("clinicId") REFERENCES "Clinic"("clinicId")
ON DELETE SET NULL ON UPDATE CASCADE;
