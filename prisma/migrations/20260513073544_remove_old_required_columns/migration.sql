/*
  Warnings:

  - You are about to drop the column `aiConfidence` on the `CaseReview` table. All the data in the column will be lost.
  - You are about to drop the column `aiConfidencePercentage` on the `CaseReview` table. All the data in the column will be lost.
  - You are about to drop the column `aiPredictionLabel` on the `CaseReview` table. All the data in the column will be lost.
  - You are about to drop the column `alternativePredictions` on the `CaseReview` table. All the data in the column will be lost.
  - You are about to drop the column `bodySite` on the `CaseReview` table. All the data in the column will be lost.
  - You are about to drop the column `clinicalImageUrl` on the `CaseReview` table. All the data in the column will be lost.
  - You are about to drop the column `patientAge` on the `CaseReview` table. All the data in the column will be lost.
  - You are about to drop the column `patientGender` on the `CaseReview` table. All the data in the column will be lost.
  - You are about to drop the column `patientId` on the `CaseReview` table. All the data in the column will be lost.
  - You are about to drop the column `patientName` on the `CaseReview` table. All the data in the column will be lost.
  - You are about to drop the column `patientNotes` on the `CaseReview` table. All the data in the column will be lost.
  - You are about to drop the column `detectionId` on the `Consultation` table. All the data in the column will be lost.
  - You are about to drop the column `doctorId` on the `DoctorProfile` table. All the data in the column will be lost.
  - You are about to drop the column `profileImageUrl` on the `DoctorProfile` table. All the data in the column will be lost.
  - You are about to drop the column `relatedReportId` on the `PatientNotification` table. All the data in the column will be lost.
  - You are about to drop the column `relatedScanId` on the `PatientNotification` table. All the data in the column will be lost.
  - You are about to drop the column `relatedVerificationId` on the `PatientNotification` table. All the data in the column will be lost.
  - You are about to drop the column `profilePhotoUrl` on the `PatientProfile` table. All the data in the column will be lost.
  - You are about to drop the column `analyzeStartedAt` on the `Scan` table. All the data in the column will be lost.
  - You are about to drop the column `doctorAssessment` on the `Scan` table. All the data in the column will be lost.
  - You are about to drop the column `doctorId` on the `Scan` table. All the data in the column will be lost.
  - You are about to drop the column `doctorName` on the `Scan` table. All the data in the column will be lost.
  - You are about to drop the column `doctorVerifiedAt` on the `Scan` table. All the data in the column will be lost.
  - You are about to drop the column `assignedAt` on the `VerificationRequest` table. All the data in the column will be lost.
  - You are about to drop the `Detection` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[scanId]` on the table `Consultation` will be added. If there are existing duplicate values, this will fail.
  - Made the column `scanId` on table `CaseReview` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `scanId` to the `Consultation` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "ChatMessage" DROP CONSTRAINT "ChatMessage_consultationId_fkey";

-- DropForeignKey
ALTER TABLE "Consultation" DROP CONSTRAINT "Consultation_detectionId_fkey";

-- DropForeignKey
ALTER TABLE "Detection" DROP CONSTRAINT "Detection_userId_fkey";

-- DropIndex
DROP INDEX "AuditLog_action_createdAt_idx";

-- DropIndex
DROP INDEX "Consultation_detectionId_key";

-- DropIndex
DROP INDEX "DoctorProfile_doctorId_key";

-- DropIndex
DROP INDEX "PatientNotification_patientId_isRead_idx";

-- DropIndex
DROP INDEX "Scan_isAnalyzed_createdAt_idx";

-- DropIndex
DROP INDEX "Scan_patientId_createdAt_idx";

-- DropIndex
DROP INDEX "SystemLog_category_createdAt_idx";

-- DropIndex
DROP INDEX "VerificationRequest_patientId_status_idx";

-- AlterTable
ALTER TABLE "CaseReview" DROP COLUMN "aiConfidence",
DROP COLUMN "aiConfidencePercentage",
DROP COLUMN "aiPredictionLabel",
DROP COLUMN "alternativePredictions",
DROP COLUMN "bodySite",
DROP COLUMN "clinicalImageUrl",
DROP COLUMN "patientAge",
DROP COLUMN "patientGender",
DROP COLUMN "patientId",
DROP COLUMN "patientName",
DROP COLUMN "patientNotes",
ALTER COLUMN "scanId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Consultation" DROP COLUMN "detectionId",
ADD COLUMN     "scanId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "DoctorProfile" DROP COLUMN "doctorId",
DROP COLUMN "profileImageUrl",
ADD COLUMN     "clinicId" TEXT;

-- AlterTable
ALTER TABLE "PatientNotification" DROP COLUMN "relatedReportId",
DROP COLUMN "relatedScanId",
DROP COLUMN "relatedVerificationId";

-- AlterTable
ALTER TABLE "PatientProfile" DROP COLUMN "profilePhotoUrl";

-- AlterTable
ALTER TABLE "Scan" DROP COLUMN "analyzeStartedAt",
DROP COLUMN "doctorAssessment",
DROP COLUMN "doctorId",
DROP COLUMN "doctorName",
DROP COLUMN "doctorVerifiedAt";

-- AlterTable
ALTER TABLE "VerificationRequest" DROP COLUMN "assignedAt";

-- DropTable
DROP TABLE "Detection";

-- CreateIndex
CREATE UNIQUE INDEX "Consultation_scanId_key" ON "Consultation"("scanId");

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
