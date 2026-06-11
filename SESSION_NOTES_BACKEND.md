# SESSION NOTES - MySkin Backend

Catatan ini dibuat untuk memindahkan konteks backend MySkin ke device lain. Jangan sertakan secret production, token AI, password database production, atau kredensial asli saat mengirim file ini.

## 1. Setup Backend di Device Lain

### Prasyarat

- Node.js sudah terpasang.
- PostgreSQL sudah berjalan.
- Database MySkin sudah dibuat.
- Repo backend sudah dipindahkan atau di-clone.

### Install Dependency

```bash
npm install
```

### Konfigurasi `.env`

Buat file `.env` di root project. Minimal field yang perlu dicek:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE_NAME"
JWT_SECRET="isi-secret-lokal"
PORT=3300

GOOGLE_CLIENT_ID="isi-google-client-id"
GOOGLE_CLIENT_SECRET="isi-google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3300/api/auth/google/callback"
FRONTEND_URL="http://localhost:5173"

AI_BASE_URL="https://..."
AI_PREDICT_URL="https://.../predict"
AI_GRADCAM_URL="https://.../viz"
AI_ACCESS_TOKEN="isi-token-lokal-jika-diperlukan"

EMAIL_HOST="smtp.example.com"
EMAIL_PORT=587
EMAIL_USER="email@example.com"
EMAIL_PASS="password-email"
```

Catatan:
- Jangan pakai secret production untuk demo lokal.
- Jika AI token atau email belum siap, beberapa fitur tetap bisa jalan tetapi scan AI/email queue bisa gagal.

### Generate Prisma Client

```bash
npx prisma generate
```

### Apply Migration

```bash
npx prisma migrate deploy
```

Jika migration gagal karena data lama tidak cocok dengan foreign key, cek data legacy dulu. Contoh kasus yang pernah muncul: `Report.patientId` lama masih berisi `User.id`, sedangkan schema baru mengarah ke `PatientProfile.id`.

### Seeder

Seeder yang tersedia:

```bash
node prisma/seed.js
node prisma/seed-doctor.js
node prisma/demo-seed.js
```

`prisma/demo-seed.js` adalah demo seeder idempotent untuk presentasi. Aman dijalankan berkali-kali karena memakai upsert dan data demo `@myskin.local` / prefix `DEMO-`.

### Jalankan Server

Mode production/local biasa:

```bash
npm start
```

Mode development:

```bash
npm run dev
```

Default entry point:

```bash
server.js
```

### Command Test Penting

Jalankan semua test:

```bash
npm test
```

Jalankan test tertentu:

```bash
node --test test/auth.service.test.js
node --test test/maintenance-mode.test.js
node --test test/admin-settings.service.test.js
node --test test/admin-settings.controller.test.js
node --test test/admin-notification.service.test.js
node --test test/doctor-notification-settings.service.test.js
node --test test/clinic.service.test.js
node --test test/clinic-request.service.test.js
node --test test/admin-doctors.service.test.js
node --test test/doctor-consultation.controller.test.js
node --test test/doctor-report-pdf.service.test.js
node --test test/system-log.service.test.js
node --test test/admin-system-log.controller.test.js
node --test test/audit-log.service.test.js
node --test test/doctor-annotation.controller.test.js
```

## 2. Ringkasan Fitur Backend Terbaru

- Auth login hanya memperbolehkan user dengan `status = active`.
- Password backend diperkuat lewat helper validasi/hash password.
- Google login sudah disiapkan via `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, dan callback URL.
- Maintenance mode global sudah ada:
  - Admin tetap bisa akses.
  - Doctor/patient ditolak `503 MAINTENANCE_MODE` untuk protected endpoint.
- Admin Settings baru:
  - Account email/password.
  - Notifications.
  - Operations.
  - Preferences.
  - Endpoint 2FA/privacy legacy untuk admin sudah tidak dipakai.
- Admin notifications dibuat berdasarkan `AdminSettings`:
  - `doctorApprovalAlerts`
  - `clinicRequestAlerts`
  - `systemAlerts`
- Doctor notifications dibuat berdasarkan `DoctorSettings`:
  - `verificationAlerts` untuk in-app notification.
  - `emailNotifications` untuk email channel.
- Admin user management:
  - CRUD user.
  - Reset password.
  - Create doctor dengan `clinicId`.
  - Delete doctor hard delete dengan cleanup relasi consultation/chat/prescription/report relation blocker.
- Doctor management:
  - List doctor admin support filter `clinicId`.
  - Include clinic/clinicName.
  - Approval/rejection doctor.
  - Patient list dan case dashboard.
- Clinic management:
  - Clinic endpoint tersedia.
  - Delete clinic sudah diarahkan sebagai hard delete, dengan guard jika masih punya doctor terkait.
  - DoctorProfile `clinicId` nullable dan relasi clinic memakai `onDelete: SetNull`.
- Clinic request:
  - Create clinic request.
  - Admin list.
  - Approve/reject.
  - Bisa membuat clinic saat approval.
- System logs:
  - Table `SystemLog`.
  - Service create system log.
  - Event backend dapat mengisi log security/system/infrastructure/ai/user management.
  - Cleanup system logs tersedia.
- Audit logs:
  - Audit log action admin.
  - `auditId` sudah diperkuat agar tidak duplicate saat request admin paralel.
  - Cleanup audit logs tersedia.
- Admin report:
  - Generate/export analytics report.
  - PDF/TXT export.
  - Report sudah dibuat lebih detail dengan summary, scan, consultation, clinic, insight.
- Doctor report:
  - Case history PDF.
  - Per-case detailed report PDF.
- Doctor consultation/chat:
  - List/detail consultation.
  - Messages multipart/form-data.
  - Attachments.
  - Read-all.
  - Close consultation.
  - Prescription.
  - AI analysis.
- Close consultation:
  - Support `caseDisposition`.
  - Support `finalClinicalNotes`.
  - Support `emailClinicalSummary`.
  - Response menyertakan `emailClinicalSummaryQueued`.
- Delete closed consultation:
  - Doctor hanya boleh delete consultation miliknya.
  - Hanya status `CLOSED`.
  - Cleanup chat messages, attachments, read receipts, prescriptions.
- Doctor annotation:
  - Upload annotation image ke case.
  - Simpan URL ke `Scan.annotatedImageUrl`.
  - Response controller terbaru mengembalikan `data.annotatedImageUrl`.
- Grad-CAM:
  - AI Grad-CAM dipanggil saat analyze scan.
  - Hasil disimpan ke `Scan.gradcamUrl`.
  - Detail case doctor menampilkan `aiPrediction.gradcamUrl`.

## 3. Daftar Endpoint Penting

Base path umum:

```text
http://localhost:3300
```

### Auth

```http
POST /api/auth/login
POST /api/auth/register
GET  /api/auth/google
GET  /api/auth/google/callback
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

### Admin Users / Doctors / Patients

```http
GET    /api/v1/admin/users
POST   /api/v1/admin/users
GET    /api/v1/admin/users/:userId
PATCH  /api/v1/admin/users/:userId
DELETE /api/v1/admin/users/:userId
POST   /api/v1/admin/users/:userId/reset-password

GET    /api/v1/admin/doctors
GET    /api/v1/admin/doctors?clinicId=<clinicId>
PATCH  /api/v1/admin/doctors/:doctorId/approve
PATCH  /api/v1/admin/doctors/:doctorId/reject

GET    /api/v1/admin/patients
```

### Clinics dan Clinic Requests

```http
GET    /api/v1/clinics
GET    /api/v1/clinics?isActive=true
POST   /api/v1/clinics
GET    /api/v1/clinics/:clinicId
PATCH  /api/v1/clinics/:clinicId
DELETE /api/v1/clinics/:clinicId

POST   /api/v1/clinic-requests
GET    /api/v1/clinic-requests
PATCH  /api/v1/clinic-requests/:id
```

### Admin Settings

```http
GET   /api/v1/admin/settings
PATCH /api/v1/admin/settings/account
PATCH /api/v1/admin/settings/notifications
GET   /api/v1/admin/settings/operations
PATCH /api/v1/admin/settings/operations
PATCH /api/v1/admin/settings/preferences
POST  /api/v1/admin/settings/operations/audit-log-cleanup
```

### Admin Notifications

```http
GET   /api/v1/admin/notifications
PATCH /api/v1/admin/notifications/:notificationId/read
PATCH /api/v1/admin/notifications/read-all
```

### Admin System Logs dan Audit Logs

```http
GET  /api/v1/admin/system/logs
POST /api/v1/admin/system/logs/cleanup

GET  /api/v1/admin/audit-logs
```

### Admin Reports

```http
POST /api/v1/admin/dashboard/report/generate
GET  /api/v1/admin/dashboard/report/export
```

### Doctor Cases / History / Reports

```http
GET   /api/v1/doctor/dashboard/summary
GET   /api/v1/doctor/cases/assigned
GET   /api/v1/doctor/cases/history
GET   /api/v1/doctor/cases/history/download
GET   /api/v1/doctor/cases/:caseId
POST  /api/v1/doctor/cases/:caseId/report/generate
GET   /api/v1/doctor/cases/:caseId/report/download
PATCH /api/v1/doctor/cases/:caseId/approve
PATCH /api/v1/doctor/cases/:caseId/reject
POST  /api/v1/doctor/cases/:caseId/observation
POST  /api/v1/doctor/cases/:caseId/annotation
GET   /api/v1/doctor/patients/:patientId/evolution
```

### Doctor Consultations / Messages

```http
GET    /api/v1/doctor/consultations
GET    /api/v1/doctor/consultations/:consultationId
GET    /api/v1/doctor/consultations/:consultationId/messages
POST   /api/v1/doctor/consultations/:consultationId/messages
PATCH  /api/v1/doctor/consultations/:consultationId/read-all
PATCH  /api/v1/doctor/consultations/:consultationId/close
DELETE /api/v1/doctor/consultations/:consultationId
POST   /api/v1/doctor/consultations/:consultationId/prescriptions
GET    /api/v1/doctor/consultations/:consultationId/ai-analysis
```

### Patient Scan / Report / Consultation / Verification

```http
GET  /api/v1/patient/dashboard

POST /api/v1/patient/scans/upload
POST /api/v1/patient/scans/:scanId/analyze
GET  /api/v1/patient/scans/:scanId/analysis
GET  /api/v1/patient/scans/recent
GET  /api/v1/patient/scans/history
GET  /api/v1/patient/scans/:scanId
GET  /api/v1/patient/scans/:scanId/export-pdf
POST /api/v1/patient/scans/:scanId/share

GET  /api/v1/patient/reports
GET  /api/v1/patient/reports/:reportId
GET  /api/v1/patient/reports/:reportId/preview
GET  /api/v1/patient/reports/:reportId/download

POST /api/v1/patient/consultations/initiate
GET  /api/v1/patient/consultations
GET  /api/v1/patient/consultations/:consultationId
GET  /api/v1/patient/consultations/:consultationId/messages
POST /api/v1/patient/consultations/:consultationId/messages
PATCH /api/v1/patient/consultations/:consultationId/read-all

POST /api/v1/patient/verification-requests
GET  /api/v1/patient/verification-requests
```

### Guest Scan

```http
POST /api/guest/scan
GET  /api/guest/scan/:sessionId
GET  /api/guest/info
```

## 4. Kontrak Terbaru Grad-CAM dan Annotation

### Patient Scan + Grad-CAM

Grad-CAM tidak punya endpoint publik sendiri. Backend memanggil AI Grad-CAM otomatis saat patient menjalankan:

```http
POST /api/v1/patient/scans/:scanId/analyze
```

Flow:

1. Patient upload scan:

```http
POST /api/v1/patient/scans/upload
Content-Type: multipart/form-data
Field:
- image
- complaint
- bodySite
```

2. Patient analyze scan:

```http
POST /api/v1/patient/scans/:scanId/analyze
Authorization: Bearer <patient_token>
```

Backend akan call:

```text
AI_PREDICT_URL
AI_GRADCAM_URL
```

Jika Grad-CAM berhasil:

```json
{
  "gradcamUrl": "/uploads/gradcam/gradcam_xxx.jpg"
}
```

Field yang disimpan:

```text
Scan.gradcamUrl
```

### Doctor Annotation

Endpoint:

```http
POST /api/v1/doctor/cases/:caseId/annotation
```

Auth:

```http
Authorization: Bearer <doctor_token>
```

Content-Type:

```http
multipart/form-data
```

Field:

```text
annotationImage
```

Success response:

```json
{
  "status": "success",
  "message": "Coretan dokter berhasil disimpan pada data Scan",
  "data": {
    "annotatedImageUrl": "/uploads/annotations/annotation_xxx.png"
  }
}
```

Field yang disimpan:

```text
Scan.annotatedImageUrl
```

Cara ambil ulang hasil annotation:

```http
GET /api/v1/doctor/cases/:caseId
```

Path response:

```json
{
  "data": {
    "clinicalImage": {
      "annotatedImageUrl": "/uploads/annotations/annotation_xxx.png"
    }
  }
}
```

## 5. Catatan Database / Migration Penting

Pastikan migration berikut sudah masuk ke database device baru:

- `Scan.gradcamUrl`
- `Scan.annotatedImageUrl`
- `Report.caseDisposition`
- `Report.finalClinicalNotes`
- `Report.patientId` relasi ke `PatientProfile.id`
- Field baru `AdminSettings`:
  - `doctorApprovalAlerts`
  - `clinicRequestAlerts`
  - `systemAlerts`
  - `weeklyDigest`
  - `defaultPageSize`
  - `auditLogRetentionDays`
  - `maintenanceMode`
  - `deleteConfirmationRequired`
  - `language`
  - `timezone`
- `DoctorProfile.clinicId` nullable.
- Relasi `DoctorProfile -> Clinic` memakai delete behavior aman, saat ini `onDelete: SetNull`.
- Hard delete doctor perlu cleanup eksplisit untuk:
  - `ChatMessageReadReceipt`
  - `ChatMessageAttachment`
  - `ChatMessage`
  - `Prescription`
  - `Consultation`
  - `CaseReview`
  - `DoctorObservation`
  - `Notification`
  - `DoctorSettings`
  - `CaseAssignment`
- `SystemLog` table dan service sudah ada.
- `AuditLog.auditId` harus unik dan generator tidak boleh hanya berbasis `Date.now()`.

Catatan penting:

Jika menjalankan migration pada database lama dan muncul error FK `Report_patientId_fkey`, kemungkinan ada data `Report.patientId` lama berisi `User.id`. Data lama itu perlu dimigrasikan ke `PatientProfile.id` sebelum `prisma migrate deploy` bisa sukses.

## 6. Test yang Perlu Dijalankan Ulang

Test penting:

```bash
node --test test/auth.service.test.js
node --test test/maintenance-mode.test.js
node --test test/admin-settings.service.test.js
node --test test/admin-settings.controller.test.js
node --test test/admin.validator.test.js
node --test test/admin-notification.service.test.js
node --test test/doctor-notification-settings.service.test.js
node --test test/clinic.service.test.js
node --test test/clinic-request.service.test.js
node --test test/admin-doctors.service.test.js
node --test test/admin-create-doctor.service.test.js
node --test test/admin-delete-user.service.test.js
node --test test/doctor-consultation.controller.test.js
node --test test/consultation.service.test.js
node --test test/consultation.validator.test.js
node --test test/doctor-report-pdf.service.test.js
node --test test/system-log.service.test.js
node --test test/admin-system-log.controller.test.js
node --test test/audit-log.service.test.js
node --test test/doctor-annotation.controller.test.js
```

Semua test:

```bash
npm test
```

Catatan:

- `doctor-annotation.controller.test.js` adalah unit test controller untuk memastikan response `data.annotatedImageUrl` tersedia.
- `doctor-report-pdf.service.test.js` pernah tidak sinkron dengan kontrak service terbaru jika masih mengharapkan buffer PDF langsung. Cek ulang ekspektasi test sesuai implementasi terbaru.

## 7. Akun Demo / Seeder

### File Seeder

```text
prisma/seed.js
prisma/seed-doctor.js
prisma/demo-seed.js
```

### `prisma/seed.js`

Seeder dasar admin:

```text
admin@melanoma.com
```

Password di seed dasar mengikuti isi file seed.

### `prisma/seed-doctor.js`

Seeder dashboard doctor/patient lama, termasuk:

```text
elenaaris@icloud.com
jamesmitchell@clinic.com
sarah.johnson@example.com
michael.chen@example.com
```

Password di file ini:

```text
Str0ng!Pass2026
```

### `prisma/demo-seed.js`

Seeder demo presentasi MySkin. Data demo memakai domain:

```text
@myskin.local
```

Akun demo:

```text
admin.demo@myskin.local
ops.admin@myskin.local
elena.aris@myskin.local
james.mitchell@myskin.local
pending.doctor@myskin.local
rejected.doctor@myskin.local
sarah.johnson@myskin.local
robert.taylor@myskin.local
michael.chen@myskin.local
inactive.patient@myskin.local
```

Password semua akun demo:

```text
password123
```

Catatan:

- Jangan gunakan password demo untuk production.
- Jangan kirim `.env` production via WhatsApp.
- Seeder demo idempotent dan aman dijalankan berulang untuk data demo.

## 8. Checklist Sebelum Demo

- [ ] Database PostgreSQL berjalan.
- [ ] `.env` sudah dibuat dan `DATABASE_URL` benar.
- [ ] `npm install` selesai.
- [ ] `npx prisma generate` selesai.
- [ ] `npx prisma migrate deploy` selesai tanpa error.
- [ ] Jika migration gagal karena data lama, rapikan data legacy dulu.
- [ ] Jalankan seed:

```bash
node prisma/demo-seed.js
```

- [ ] Folder `uploads` tersedia.
- [ ] Folder berikut bisa dibuat otomatis saat upload/report:
  - `uploads/gradcam`
  - `uploads/annotations`
  - `uploads/reports`
- [ ] Server running:

```bash
npm start
```

atau:

```bash
npm run dev
```

- [ ] Login admin bisa.
- [ ] Login doctor bisa.
- [ ] Login patient bisa.
- [ ] User inactive tidak bisa login.
- [ ] Maintenance mode off untuk demo normal.
- [ ] Doctor approval pending tersedia.
- [ ] Clinic request pending tersedia.
- [ ] Assigned case doctor tersedia.
- [ ] Patient scan history tampil.
- [ ] Lesion evolution tampil lebih dari satu scan.
- [ ] Grad-CAM bisa disimpan saat analyze scan.
- [ ] Annotation dokter bisa upload dan mengembalikan `annotatedImageUrl`.
- [ ] Doctor consultation chat bisa dibuka.
- [ ] Close consultation bisa mengirim `caseDisposition` dan `finalClinicalNotes`.
- [ ] Delete closed consultation bisa.
- [ ] Admin system logs tampil.
- [ ] Audit logs tampil.
- [ ] Admin report PDF bisa dibuat/dibuka.
- [ ] Doctor case history/report PDF bisa dibuat/dibuka.

## 9. Known Notes / Perhatian

- Endpoint annotation controller sudah diperbaiki agar frontend menerima `data.annotatedImageUrl`.
- Runtime annotation tetap membutuhkan kolom database `Scan.annotatedImageUrl`.
- Patient report list/detail memakai `Report.patientId = PatientProfile.id`.
- Beberapa jalur lama pernah memakai `User.id` untuk `Report.patientId`; cek lagi jika report patient tidak muncul.
- Download report patient membutuhkan `pdfUrl` sudah tersedia.
- Doctor report download saat ini memakai generator PDF; pastikan tidak membuat report dobel jika frontend sering memanggil endpoint download.
- Jangan commit file upload hasil demo/test kecuali memang dibutuhkan.
