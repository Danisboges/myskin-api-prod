/*
  Warnings:

  - A unique constraint covering the columns `[scanId]` on the table `CaseReview` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `scanId` to the `CaseReview` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CaseReview" ADD COLUMN     "scanId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CaseReview_scanId_key" ON "CaseReview"("scanId");

-- AddForeignKey
ALTER TABLE "CaseReview" ADD CONSTRAINT "CaseReview_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
