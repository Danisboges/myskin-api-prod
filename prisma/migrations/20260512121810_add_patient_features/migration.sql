-- CreateTable
CREATE TABLE "PatientProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "medicalHistory" TEXT,
    "allergies" TEXT,
    "medications" TEXT,
    "familyHistory" TEXT,
    "profilePhotoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scan" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isAnalyzed" BOOLEAN NOT NULL DEFAULT false,
    "analyzeStartedAt" TIMESTAMP(3),
    "analyzeCompletedAt" TIMESTAMP(3),
    "aiPrediction" TEXT,
    "aiConfidence" DOUBLE PRECISION,
    "aiDetails" TEXT,
    "doctorId" TEXT,
    "doctorName" TEXT,
    "doctorAssessment" TEXT,
    "doctorVerifiedAt" TIMESTAMP(3),
    "bodySite" TEXT,
    "complaint" TEXT,
    "notes" TEXT,
    "isSharedWithDoctor" BOOLEAN NOT NULL DEFAULT false,
    "sharedWith" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "diagnosis" TEXT NOT NULL,
    "recommendation" TEXT,
    "pdfUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approvedByDoctorId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationRequest" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "message" TEXT,
    "assignedDoctorId" TEXT,
    "assignedDoctorName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientNotification" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "relatedScanId" TEXT,
    "relatedReportId" TEXT,
    "relatedVerificationId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientSettings" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "scanNotifications" BOOLEAN NOT NULL DEFAULT true,
    "reportNotifications" BOOLEAN NOT NULL DEFAULT true,
    "dataVisibility" "DataVisibility" NOT NULL DEFAULT 'restricted_self_only',
    "language" TEXT NOT NULL DEFAULT 'English (US)',
    "theme" TEXT NOT NULL DEFAULT 'light',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PatientProfile_userId_key" ON "PatientProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Scan_scanId_key" ON "Scan"("scanId");

-- CreateIndex
CREATE INDEX "Scan_patientId_createdAt_idx" ON "Scan"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "Scan_isAnalyzed_createdAt_idx" ON "Scan"("isAnalyzed", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Report_reportId_key" ON "Report"("reportId");

-- CreateIndex
CREATE INDEX "Report_patientId_createdAt_idx" ON "Report"("patientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationRequest_requestId_key" ON "VerificationRequest"("requestId");

-- CreateIndex
CREATE INDEX "VerificationRequest_patientId_status_idx" ON "VerificationRequest"("patientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PatientNotification_notificationId_key" ON "PatientNotification"("notificationId");

-- CreateIndex
CREATE INDEX "PatientNotification_patientId_isRead_idx" ON "PatientNotification"("patientId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "PatientSettings_patientId_key" ON "PatientSettings"("patientId");

-- AddForeignKey
ALTER TABLE "PatientProfile" ADD CONSTRAINT "PatientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scan" ADD CONSTRAINT "Scan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientNotification" ADD CONSTRAINT "PatientNotification_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientSettings" ADD CONSTRAINT "PatientSettings_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "PatientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
