-- Create clinic table and connect existing DoctorProfile.clinicId values safely.

CREATE TABLE "Clinic" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Clinic_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Clinic_clinicId_key" ON "Clinic"("clinicId");
CREATE INDEX "Clinic_name_idx" ON "Clinic"("name");
CREATE INDEX "Clinic_isActive_idx" ON "Clinic"("isActive");

INSERT INTO "Clinic" ("id", "clinicId", "name", "updatedAt")
SELECT
    "clinicId",
    "clinicId",
    CONCAT('Clinic ', "clinicId"),
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT "clinicId"
    FROM "DoctorProfile"
    WHERE "clinicId" IS NOT NULL AND TRIM("clinicId") <> ''
) AS existing_clinics
ON CONFLICT ("clinicId") DO NOTHING;

ALTER TABLE "DoctorProfile"
ADD CONSTRAINT "DoctorProfile_clinicId_fkey"
FOREIGN KEY ("clinicId") REFERENCES "Clinic"("clinicId")
ON DELETE SET NULL ON UPDATE CASCADE;
