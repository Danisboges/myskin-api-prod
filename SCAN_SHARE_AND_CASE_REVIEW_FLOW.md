# Scan Share dan Case Review Flow - Dokumentasi Lengkap

## Masalah yang Diperbaiki

Sebelumnya, ketika patient melakukan share scan kepada doctor untuk di-review, endpoint `/api/v1/doctor/cases/assigned` tidak menampilkan data karena alur tidak lengkap.

**Penyebab Root:**
- Flow hanya update field `sharedWith` di table `Scan`, tidak membuat record di `CaseReview` dan `CaseAssignment`
- `DoctorObservation` dan `CaseAssignment` adalah dua table terpisah yang keduanya penting:
  - **CaseAssignment**: Track mana cases yang di-assign ke doctor (untuk list assigned cases)
  - **DoctorObservation**: Track observations/notes yang ditulis doctor untuk setiap case

---

## Alur Lengkap Setelah Perbaikan

### 1. **Patient Upload Scan**
```
POST /api/v1/patient/scans/upload
├─ File image diunggah
├─ Scan record dibuat di table Scan
└─ Status: isAnalyzed = false, sharepWith = []
```

### 2. **Patient Share Scan dengan Doctor (ENDPOINT PERBAIKAN)**
```
POST /api/v1/patient/scans/{scanId}/share
Body: { "doctorUserId": "ebf997c6-1dd5-4588-a992-8051f79c478b" }

├─ Validasi scan milik patient
├─ Validasi doctor exists via userId
├─ Update Scan table:
│  └─ isSharedWithDoctor = true
│  └─ sharedWith = ["ebf997c6-1dd5-4588-a992-8051f79c478b"]
│
├─ CREATE CaseReview Record:
│  ├─ caseId: "SK-1715598742183" (generated)
│  ├─ scanId: <link ke Scan record> ← FIELD BARU
│  ├─ patientId, patientName, patientAge, patientGender
│  ├─ clinicalImageUrl, bodySite
│  ├─ aiPredictionLabel, aiConfidencePercentage
│  ├─ patientNotes, complaint
│  └─ reviewStatus: "pending_review"
│
└─ CREATE CaseAssignment Record:
   ├─ doctorId: <DoctorProfile.id dari userId>
   ├─ caseId: "SK-1715598742183"
   └─ assignedAt: now()
```

### 3. **Doctor View Assigned Cases**
```
GET /api/v1/doctor/cases/assigned

├─ Lookup DoctorProfile dari userId
├─ Query CaseAssignment by doctorId
├─ Get case IDs dari assignments
├─ Query CaseReview dengan:
│  └─ caseId IN (assignments.caseIds)
│  └─ reviewStatus = "pending_review"
└─ Return list dengan format:
   {
     "caseId": "SK-1715598742183",
     "patientName": "John Doe",
     "patientAge": 35,
     "patientGender": "male",
     "receivedAt": "2026-05-13T10:30:00Z",
     "status": "pending_review",
     "avatarUrl": "/uploads/patients/john-doe.png"
   }
```

### 4. **Doctor Submit Observation**
```
POST /api/v1/doctor/cases/{caseId}/observation

├─ Lookup CaseReview by caseId
├─ CREATE DoctorObservation:
│  ├─ caseReviewId: <CaseReview.id>
│  ├─ doctorId: <DoctorProfile.id>
│  ├─ observation: "<doctor notes>"
│  └─ createdAt: now()
└─ Response: Created observation
```

### 5. **Doctor Approve/Reject Case**
```
PATCH /api/v1/doctor/cases/{caseId}/approve
PATCH /api/v1/doctor/cases/{caseId}/reject

├─ Update CaseReview:
│  ├─ reviewStatus: "approved" atau "rejected"
│  ├─ doctorId: <DoctorProfile.id>
│  ├─ finalDiagnosis: <diagnosis>
│  ├─ physicianObservation: <detailed notes>
│  ├─ rejectionReason: <reason if rejected>
│  └─ reviewedAt: now()
└─ Response: Updated case
```

---

## Perubahan Skema Database

### Table: `CaseReview`
```sql
-- FIELD BARU (Added)
scanId              TEXT UNIQUE   -- Foreign key ke Scan.id
scan                Scan          @relation

-- DITERUSKAN (Existing)
caseId              TEXT @unique
patientId, patientName, patientAge, patientGender
clinicalImageUrl, bodySite
aiPredictionLabel, aiConfidencePercentage
patientNotes
doctorId, doctor, reviewStatus
physicianObservation, finalDiagnosis
rejectionReason, receivedAt, reviewedAt
observations        DoctorObservation[]
```

### Table: `Scan`
```sql
-- FIELD BARU (Added)
caseReview          CaseReview?   -- Reverse relation

-- TETAP (Existing)
scanId, patientId, patient
imageUrl, uploadedAt
isAnalyzed, analyzeStartedAt, analyzeCompletedAt
aiPrediction, aiConfidence, aiDetails
doctorId, doctorName (decorative only)
bodySite, complaint, notes
isSharedWithDoctor
sharedWith          JSON array of doctorUserIds
reports             Report[]
```

### Table: `CaseAssignment` (Tidak berubah)
```sql
id, doctorId, doctor
caseId              -- Foreign key ke CaseReview.caseId
assignedAt, createdAt, updatedAt
@@unique([doctorId, caseId])
```

### Table: `DoctorObservation` (Tidak berubah)
```sql
id, caseReviewId, caseReview
doctorId, doctor
observation
createdAt, updatedAt
```

---

## Perubahan Code

### 1. **patient.service.js** - `shareScanWithDoctor()`
```javascript
// BEFORE: Hanya update Scan table
updatedScan = await prisma.scan.update({...})

// AFTER: Update Scan + Create CaseReview + Create CaseAssignment
updatedScan = await prisma.scan.update({...})
if (isNewShare) {
  caseReview = await prisma.caseReview.create({
    data: {
      caseId: `SK-${Date.now()}`,
      scanId: scan.id,  // ← BARU
      patientId, patientName, patientAge, patientGender,
      clinicalImageUrl: scan.imageUrl,
      bodySite: scan.bodySite,
      aiPredictionLabel: scan.aiPrediction,
      aiConfidencePercentage: scan.aiConfidence,
      patientNotes: scan.complaint,
      reviewStatus: 'pending_review'
    }
  })
  
  await prisma.caseAssignment.upsert({
    where: { doctorId_caseId: {...} },
    create: { doctorId, caseId: caseReview.caseId },
    update: {}
  })
}
```

### 2. **doctor.service.js** - `getAssignedCases()`
```javascript
// BEFORE: Received doctorId directly
const getAssignedCases = async (doctorId, filters) => {
  const assignments = await prisma.caseAssignment.findMany({
    where: { doctorId },
    ...
  })
}

// AFTER: Receive userId, lookup doctorId first
const getAssignedCases = async (userId, filters) => {
  const doctorProfile = await prisma.doctorProfile.findUnique({
    where: { userId }
  })
  const assignments = await prisma.caseAssignment.findMany({
    where: { doctorId: doctorProfile.id },
    ...
  })
}
```

### 3. **prisma/schema.prisma**
```prisma
model CaseReview {
  id                      String              @id @default(uuid())
  caseId                  String              @unique
  
  // FIELD BARU
  scanId                  String?             @unique
  scan                    Scan?               @relation(fields: [scanId], references: [id], onDelete: Cascade)
  
  patientId, patientName, patientAge, patientGender
  clinicalImageUrl, zoom, light, bodySite
  aiConfidence, aiPredictionLabel, aiConfidencePercentage
  alternativePredictions
  patientNotes
  doctorId, doctor
  physicianObservation, finalDiagnosis
  reviewStatus            CaseReviewStatus    @default(pending_review)
  rejectionReason
  receivedAt, reviewedAt, createdAt, updatedAt
  observations            DoctorObservation[]
}

model Scan {
  id, scanId, patientId, patient
  imageUrl, uploadedAt
  isAnalyzed, analyzeStartedAt, analyzeCompletedAt
  aiPrediction, aiConfidence, aiDetails
  doctorId, doctorName
  bodySite, complaint, notes
  isSharedWithDoctor
  sharedWith              String?             @db.Text
  createdAt, updatedAt
  reports                 Report[]
  caseReview              CaseReview?         // BARU
}
```

---

## Migrasi Database

File migrasi telah dibuat:
```
migrations/20260512214143_add_scanid_to_casereview/migration.sql
```

Perubahan:
1. Tambah kolom `scanId` ke table `CaseReview` (nullable untuk existing records)
2. Tambah foreign key constraint ke table `Scan`
3. Tambah unique index pada `scanId`

---

## Testing Checklist

### Happy Path
```
✅ 1. Patient upload scan
✅ 2. Patient share scan dengan doctor (doctorUserId)
   └─ Validasi CaseReview created dengan scanId
   └─ Validasi CaseAssignment created
✅ 3. Doctor view assigned cases (GET /cases/assigned)
   └─ Validasi data muncul dari CaseReview
✅ 4. Doctor view case detail
   └─ Validasi semua data terload
✅ 5. Doctor submit observation
   └─ Validasi DoctorObservation created
✅ 6. Doctor approve case
   └─ Validasi status changed to 'approved'
✅ 7. Doctor reject case
   └─ Validasi status changed to 'rejected'
```

### Edge Cases
```
⚠️ Share dengan doctor yang sama 2x
   └─ CaseAssignment harusnya upsert, jangan duplicate
⚠️ Share scan tanpa analysis
   └─ CaseReview tetap created dengan status pending_review
⚠️ Delete scan yang sudah di-share
   └─ CaseReview should cascade delete (onDelete: Cascade)
```

---

## Summary

**Sebelum:** Alur incomplete → doctor tidak ada case untuk di-review
**Sesudah:** Alur complete → CaseReview dibuat otomatis saat share → doctor bisa lihat di `/cases/assigned`

### Key Points:
1. ✅ **Relasi Scan ↔ CaseReview**: Satu scan bisa punya satu CaseReview (1-to-1)
2. ✅ **CaseAssignment**: Track case mana assigned ke doctor mana
3. ✅ **DoctorObservation**: Track notes yang ditulis doctor
4. ✅ **userId vs doctorId**: Query menggunakan userId (FK di User), bukan decorative doctorId
5. ✅ **Database Migrasi**: Applied successfully, Prisma client regenerated
