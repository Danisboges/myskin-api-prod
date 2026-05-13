-- CreateEnum
CREATE TYPE "CaseReviewStatus" AS ENUM ('pending_review', 'approved', 'rejected', 'under_review');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('case_request', 'scan_complete', 'verification_alert', 'system_message');

-- CreateEnum
CREATE TYPE "DataVisibility" AS ENUM ('restricted_clinical_team_only', 'restricted_self_only', 'shared_with_clinic');

-- CreateTable
CREATE TABLE "DoctorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "profileImageUrl" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'unverified',
    "practitionerLicense" TEXT,
    "specialization" TEXT NOT NULL DEFAULT 'Dermatology',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseReview" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientAge" INTEGER NOT NULL,
    "patientGender" TEXT NOT NULL,
    "clinicalImageUrl" TEXT NOT NULL,
    "zoom" TEXT DEFAULT '4.0x',
    "light" TEXT DEFAULT 'Polarized',
    "bodySite" TEXT,
    "aiConfidence" TEXT NOT NULL DEFAULT 'MEDIUM CONFIDENCE',
    "aiPredictionLabel" TEXT NOT NULL,
    "aiConfidencePercentage" DOUBLE PRECISION NOT NULL,
    "alternativePredictions" TEXT,
    "patientNotes" TEXT,
    "doctorId" TEXT,
    "physicianObservation" TEXT,
    "finalDiagnosis" TEXT,
    "reviewStatus" "CaseReviewStatus" NOT NULL DEFAULT 'pending_review',
    "rejectionReason" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorObservation" (
    "id" TEXT NOT NULL,
    "caseReviewId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "observation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseAssignment" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorSettings" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "verificationAlerts" BOOLEAN NOT NULL DEFAULT true,
    "dataVisibility" "DataVisibility" NOT NULL DEFAULT 'restricted_clinical_team_only',
    "language" TEXT NOT NULL DEFAULT 'English (US)',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'system_message',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DoctorProfile_userId_key" ON "DoctorProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorProfile_doctorId_key" ON "DoctorProfile"("doctorId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseReview_caseId_key" ON "CaseReview"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseAssignment_doctorId_caseId_key" ON "CaseAssignment"("doctorId", "caseId");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorSettings_doctorId_key" ON "DoctorSettings"("doctorId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_notificationId_key" ON "Notification"("notificationId");

-- AddForeignKey
ALTER TABLE "DoctorProfile" ADD CONSTRAINT "DoctorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseReview" ADD CONSTRAINT "CaseReview_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorObservation" ADD CONSTRAINT "DoctorObservation_caseReviewId_fkey" FOREIGN KEY ("caseReviewId") REFERENCES "CaseReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorObservation" ADD CONSTRAINT "DoctorObservation_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseAssignment" ADD CONSTRAINT "CaseAssignment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorSettings" ADD CONSTRAINT "DoctorSettings_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "DoctorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
