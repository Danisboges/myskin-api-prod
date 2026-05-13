# Patient API Documentation

**Base URL:** `http://localhost:3000/api/v1/patient`

**Authentication:** All endpoints require JWT Bearer token in `Authorization` header

**Authorization:** All endpoints require `role: patient`

---

## Table of Contents

1. [Dashboard](#dashboard)
2. [Scans](#scans)
3. [Reports](#reports)
4. [Profile](#profile)
5. [Settings](#settings)
6. [Notifications](#notifications)
7. [Doctors & Verification](#doctors--verification)

---

## Dashboard

### GET /dashboard

Mendapatkan dashboard overview pasien termasuk statistik scans, reports, dan notifikasi terbaru.

**Authentication:** Required (Bearer Token)  
**Authorization:** Pasien only  
**Rate Limit:** 10/minute

#### Request

```bash
curl -X GET http://localhost:3000/api/v1/patient/dashboard \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json"
```

#### Response

**Status: 200 OK**

```json
{
  "status": "success",
  "data": {
    "patient": {
      "id": "user-id-123",
      "name": "Sarah Johnson",
      "email": "sarah@mail.com",
      "phone": "+6281234567",
      "gender": "female",
      "birthDate": "1998-01-15T00:00:00Z"
    },
    "statistics": {
      "totalScans": 8,
      "analyzedScans": 5,
      "totalReports": 3
    },
    "recentScans": [
      {
        "id": "scan-uuid-1",
        "scanId": "SCN-1234567890",
        "imageUrl": "/uploads/scan_1.jpg",
        "complaint": "New mole appeared",
        "bodySite": "arms",
        "isAnalyzed": true,
        "aiPrediction": "Benign",
        "aiConfidence": 0.85,
        "uploadedAt": "2025-05-10T10:30:00Z",
        "analyzeCompletedAt": "2025-05-10T10:35:00Z"
      }
    ],
    "pendingVerifications": [
      {
        "id": "ver-uuid-1",
        "requestId": "VER-1234567890",
        "message": "Please review my concerning moles",
        "status": "pending",
        "submittedAt": "2025-05-08T15:20:00Z"
      }
    ],
    "notifications": [
      {
        "id": "notif-uuid-1",
        "notificationId": "PN-1234567890",
        "title": "Scan Analysis Complete",
        "message": "Your scan has been analyzed",
        "type": "scan_completed",
        "isRead": false,
        "createdAt": "2025-05-10T10:35:00Z"
      }
    ]
  }
}
```

---

## Scans

### POST /scans/upload

Upload lesion image untuk dianalisis oleh AI.

**Authentication:** Required  
**Content-Type:** multipart/form-data  
**Max File Size:** 10MB

#### Request

```bash
curl -X POST http://localhost:3000/api/v1/patient/scans/upload \
  -H "Authorization: Bearer {token}" \
  -F "image=@lesion.jpg" \
  -F "complaint=New mole on my arm appeared last month" \
  -F "bodySite=arms"
```

#### Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| image | file | Yes | Lesion image (JPEG, PNG, WebP). Max 10MB |
| complaint | string | Yes | Patient's description of the lesion. Min 5 chars |
| bodySite | string | No | Body location (e.g., arms, chest, legs, back, face) |

#### Response

**Status: 201 Created**

```json
{
  "status": "success",
  "data": {
    "scanId": "SCN-1234567890",
    "id": "scan-uuid-123",
    "imageUrl": "/uploads/scan_1234567890.jpg",
    "uploadedAt": "2025-05-10T10:30:00Z",
    "message": "Scan uploaded successfully. Waiting for analysis."
  }
}
```

---

### POST /scans/{scanId}/analyze

Trigger AI analysis pada scan yang sudah diupload.

**Authentication:** Required

#### Request

```bash
curl -X POST http://localhost:3000/api/v1/patient/scans/SCN-1234567890/analyze \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json"
```

#### Response

**Status: 200 OK**

```json
{
  "status": "success",
  "data": {
    "scanId": "SCN-1234567890",
    "aiPrediction": "Benign",
    "aiConfidence": 0.8456,
    "analyzeCompletedAt": "2025-05-10T10:35:00Z",
    "message": "Scan analyzed successfully"
  }
}
```

---

### GET /scans/{scanId}/analysis

Mendapatkan hasil analisis AI untuk scan tertentu.

**Authentication:** Required

#### Request

```bash
curl -X GET http://localhost:3000/api/v1/patient/scans/SCN-1234567890/analysis \
  -H "Authorization: Bearer {token}"
```

#### Response

**Status: 200 OK**

```json
{
  "status": "success",
  "data": {
    "scanId": "SCN-1234567890",
    "imageUrl": "/uploads/scan_1234567890.jpg",
    "complaint": "New mole on my arm",
    "bodySite": "arms",
    "analysis": {
      "prediction": "Benign",
      "confidence": 0.8456,
      "details": null
    },
    "doctor": null,
    "uploadedAt": "2025-05-10T10:30:00Z",
    "analyzedAt": "2025-05-10T10:35:00Z"
  }
}
```

---

### GET /scans/recent

Mendapatkan 5 scan terakhir.

**Authentication:** Required  
**Query Parameters:** page, limit

#### Request

```bash
curl -X GET "http://localhost:3000/api/v1/patient/scans/recent?page=1&limit=10" \
  -H "Authorization: Bearer {token}"
```

#### Response

**Status: 200 OK**

```json
{
  "status": "success",
  "data": [
    {
      "id": "scan-uuid-1",
      "scanId": "SCN-1234567890",
      "imageUrl": "/uploads/scan_1.jpg",
      "complaint": "New mole",
      "bodySite": "arms",
      "isAnalyzed": true,
      "aiPrediction": "Benign",
      "aiConfidence": 0.85,
      "uploadedAt": "2025-05-10T10:30:00Z",
      "analyzeCompletedAt": "2025-05-10T10:35:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 8,
    "pages": 1
  }
}
```

---

### GET /scans/history

Mendapatkan scan history dengan filter dan pagination.

**Authentication:** Required  
**Query Parameters:** 
- page (default: 1)
- limit (default: 10, max: 100)
- bodySite (optional: arms, chest, legs, back, face)
- isAnalyzed (optional: true/false)
- sortBy (default: createdAt)
- order (default: desc)

#### Request

```bash
curl -X GET "http://localhost:3000/api/v1/patient/scans/history?page=1&limit=10&bodySite=arms&isAnalyzed=true&order=desc" \
  -H "Authorization: Bearer {token}"
```

#### Response

**Status: 200 OK**

```json
{
  "status": "success",
  "data": [
    {
      "id": "scan-uuid-1",
      "scanId": "SCN-1234567890",
      "imageUrl": "/uploads/scan_1.jpg",
      "complaint": "New mole appeared",
      "bodySite": "arms",
      "isAnalyzed": true,
      "aiPrediction": "Benign",
      "aiConfidence": 0.85,
      "uploadedAt": "2025-05-10T10:30:00Z",
      "analyzeCompletedAt": "2025-05-10T10:35:00Z",
      "isSharedWithDoctor": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 8,
    "pages": 1
  },
  "filters": {
    "bodySite": "arms",
    "isAnalyzed": "true"
  }
}
```

---

### GET /scans/{scanId}

Mendapatkan detail scan tertentu beserta reports yang terkait.

**Authentication:** Required

#### Request

```bash
curl -X GET http://localhost:3000/api/v1/patient/scans/SCN-1234567890 \
  -H "Authorization: Bearer {token}"
```

#### Response

**Status: 200 OK**

```json
{
  "status": "success",
  "data": {
    "id": "scan-uuid-1",
    "scanId": "SCN-1234567890",
    "patientId": "patient-prof-uuid",
    "imageUrl": "/uploads/scan_1.jpg",
    "uploadedAt": "2025-05-10T10:30:00Z",
    "isAnalyzed": true,
    "analyzeStartedAt": "2025-05-10T10:30:30Z",
    "analyzeCompletedAt": "2025-05-10T10:35:00Z",
    "aiPrediction": "Benign",
    "aiConfidence": 0.8456,
    "bodySite": "arms",
    "complaint": "New mole appeared",
    "notes": null,
    "isSharedWithDoctor": false,
    "reports": [
      {
        "reportId": "REP-1234567890",
        "title": "Scan Report - Arms",
        "diagnosis": "Benign",
        "status": "draft",
        "createdAt": "2025-05-10T10:35:00Z"
      }
    ]
  }
}
```

---

### GET /scans/{scanId}/export-pdf

Export scan analysis sebagai PDF.

**Authentication:** Required

#### Request

```bash
curl -X GET http://localhost:3000/api/v1/patient/scans/SCN-1234567890/export-pdf \
  -H "Authorization: Bearer {token}"
```

#### Response

**Status: 200 OK**

```json
{
  "status": "success",
  "message": "PDF export feature coming soon",
  "scanId": "SCN-1234567890"
}
```

---

### POST /scans/{scanId}/share

Share scan dengan dokter tertentu.

**Authentication:** Required

#### Request

```bash
curl -X POST http://localhost:3000/api/v1/patient/scans/SCN-1234567890/share \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "doctorId": "doctor-user-id-123"
  }'
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| doctorId | string | Yes | ID of doctor to share with |

#### Response

**Status: 200 OK**

```json
{
  "status": "success",
  "data": {
    "scanId": "SCN-1234567890",
    "isSharedWithDoctor": true,
    "sharedWith": ["doctor-uuid-1"],
    "message": "Scan shared with doctor successfully"
  }
}
```

---

## Reports

### GET /reports

Mendapatkan daftar laporan medis pasien dengan pagination dan filter.

**Authentication:** Required  
**Query Parameters:**
- page (default: 1)
- limit (default: 10, max: 100)
- status (optional: draft, approved, signed)
- sortBy (default: createdAt)
- order (default: desc)

#### Request

```bash
curl -X GET "http://localhost:3000/api/v1/patient/reports?page=1&limit=10&status=approved" \
  -H "Authorization: Bearer {token}"
```

#### Response

**Status: 200 OK**

```json
{
  "status": "success",
  "data": [
    {
      "reportId": "REP-1234567890",
      "id": "report-uuid-1",
      "title": "Scan Report - Arms",
      "diagnosis": "Benign",
      "status": "approved",
      "createdAt": "2025-05-10T10:35:00Z",
      "approvedAt": "2025-05-11T09:00:00Z",
      "scan": {
        "scanId": "SCN-1234567890",
        "imageUrl": "/uploads/scan_1.jpg"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 3,
    "pages": 1
  }
}
```

---

### GET /reports/{reportId}

Mendapatkan detail report tertentu.

**Authentication:** Required

#### Request

```bash
curl -X GET http://localhost:3000/api/v1/patient/reports/REP-1234567890 \
  -H "Authorization: Bearer {token}"
```

#### Response

**Status: 200 OK**

```json
{
  "status": "success",
  "data": {
    "id": "report-uuid-1",
    "reportId": "REP-1234567890",
    "scanId": "scan-uuid-1",
    "patientId": "user-id-123",
    "title": "Scan Report - Arms",
    "description": "Analysis report for lesion on arms",
    "diagnosis": "Benign",
    "recommendation": "Monitor for changes. No immediate action required.",
    "pdfUrl": null,
    "status": "draft",
    "approvedByDoctorId": null,
    "approvedAt": null,
    "createdAt": "2025-05-10T10:35:00Z",
    "updatedAt": "2025-05-10T10:35:00Z",
    "scan": {
      "scanId": "SCN-1234567890",
      "imageUrl": "/uploads/scan_1.jpg",
      "complaint": "New mole on my arm",
      "bodySite": "arms",
      "uploadedAt": "2025-05-10T10:30:00Z"
    }
  }
}
```

---

### GET /reports/{reportId}/download

Download report sebagai PDF file.

**Authentication:** Required

#### Request

```bash
curl -X GET http://localhost:3000/api/v1/patient/reports/REP-1234567890/download \
  -H "Authorization: Bearer {token}"
```

#### Response

**Status: 200 OK**

```json
{
  "status": "success",
  "data": {
    "reportId": "REP-1234567890",
    "pdfUrl": "/uploads/reports/REP-1234567890.pdf",
    "title": "Scan Report - Arms"
  }
}
```

---

### GET /reports/{reportId}/preview

Preview isi report tanpa download.

**Authentication:** Required

#### Request

```bash
curl -X GET http://localhost:3000/api/v1/patient/reports/REP-1234567890/preview \
  -H "Authorization: Bearer {token}"
```

#### Response

**Status: 200 OK**

```json
{
  "status": "success",
  "data": {
    "reportId": "REP-1234567890",
    "title": "Scan Report - Arms",
    "diagnosis": "Benign",
    "recommendation": "Monitor for changes. No immediate action required.",
    "scan": {
      "scanId": "SCN-1234567890",
      "imageUrl": "/uploads/scan_1.jpg"
    },
    "createdAt": "2025-05-10T10:35:00Z"
  }
}
```

---

## Profile

### GET /profile

Mendapatkan profil lengkap pasien.

**Authentication:** Required

#### Request

```bash
curl -X GET http://localhost:3000/api/v1/patient/profile \
  -H "Authorization: Bearer {token}"
```

#### Response

**Status: 200 OK**

```json
{
  "status": "success",
  "data": {
    "id": "user-id-123",
    "name": "Sarah Johnson",
    "email": "sarah@mail.com",
    "phone": "+6281234567",
    "gender": "female",
    "birthDate": "1998-01-15T00:00:00Z",
    "profilePhotoUrl": "/uploads/patients/sarah.jpg",
    "medicalHistory": [
      "History of sun exposure",
      "Atypical moles"
    ],
    "allergies": [
      "Penicillin"
    ],
    "medications": [
      {
        "name": "Sunscreen SPF 50",
        "dosage": "Daily"
      }
    ],
    "familyHistory": {
      "melanoma": true,
      "skincancer": true,
      "notes": "Mother had melanoma in 2020"
    }
  }
}
```

---

### PATCH /profile

Update profil pasien.

**Authentication:** Required

#### Request

```bash
curl -X PATCH http://localhost:3000/api/v1/patient/profile \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sarah Johnson Updated",
    "phone": "+6281234568",
    "medicalHistory": ["Sun exposure", "Previous skin cancer"],
    "allergies": ["Penicillin", "Latex"],
    "medications": [{"name": "Sunscreen", "dosage": "Daily"}]
  }'
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | No | Full name (min 3 chars) |
| phone | string | No | Phone number (min 10 digits) |
| medicalHistory | array | No | Array of medical conditions |
| allergies | array | No | Array of allergies |
| medications | array | No | Array of current medications |
| familyHistory | object | No | Family medical history |

#### Response

**Status: 200 OK**

```json
{
  "status": "success",
  "data": {
    "id": "user-id-123",
    "name": "Sarah Johnson Updated",
    "email": "sarah@mail.com",
    "phone": "+6281234568",
    "gender": "female",
    "birthDate": "1998-01-15T00:00:00Z",
    "message": "Profile updated successfully"
  }
}
```

---

### PATCH /profile/photo

Update profile photo.

**Authentication:** Required  
**Content-Type:** multipart/form-data  
**Max File Size:** 5MB

#### Request

```bash
curl -X PATCH http://localhost:3000/api/v1/patient/profile/photo \
  -H "Authorization: Bearer {token}" \
  -F "photo=@profile.jpg"
```

#### Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| photo | file | Yes | Profile photo (JPEG, PNG, WebP). Max 5MB |

#### Response

**Status: 200 OK**

```json
{
  "status": "success",
  "data": {
    "profilePhotoUrl": "/uploads/patients/sarah_new.jpg",
    "message": "Profile photo updated successfully"
  }
}
```

---

## Settings

### GET /settings

Mendapatkan semua pengaturan pasien.

**Authentication:** Required

#### Request

```bash
curl -X GET http://localhost:3000/api/v1/patient/settings \
  -H "Authorization: Bearer {token}"
```

#### Response

**Status: 200 OK**

```json
{
  "status": "success",
  "data": {
    "id": "settings-uuid-1",
    "patientId": "patient-prof-uuid",
    "twoFactorEnabled": false,
    "emailNotifications": true,
    "scanNotifications": true,
    "reportNotifications": true,
    "dataVisibility": "restricted_self_only",
    "language": "English (US)",
    "theme": "light",
    "createdAt": "2025-05-10T10:30:00Z",
    "updatedAt": "2025-05-10T10:30:00Z"
  }
}
```

---

### PATCH /settings/account

Update pengaturan akun (2FA, etc).

**Authentication:** Required

#### Request

```bash
curl -X PATCH http://localhost:3000/api/v1/patient/settings/account \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "twoFactorEnabled": true
  }'
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| twoFactorEnabled | boolean | No | Enable/disable two-factor auth |

#### Response

**Status: 200 OK**

```json
{
  "status": "success",
  "data": {
    "twoFactorEnabled": true,
    "emailNotifications": true,
    "scanNotifications": true,
    "reportNotifications": true
  },
  "message": "Account settings updated successfully"
}
```

---

### PATCH /settings/2fa

Update pengaturan two-factor authentication.

**Authentication:** Required

#### Request

```bash
curl -X PATCH http://localhost:3000/api/v1/patient/settings/2fa \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "twoFactorEnabled": true
  }'
```

#### Response

**Status: 200 OK**

```json
{
  "status": "success",
  "data": {
    "twoFactorEnabled": true
  },
  "message": "Two-factor authentication settings updated successfully"
}
```

---

### PATCH /settings/notifications

Update preferensi notifikasi.

**Authentication:** Required

#### Request

```bash
curl -X PATCH http://localhost:3000/api/v1/patient/settings/notifications \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "emailNotifications": true,
    "scanNotifications": false,
    "reportNotifications": true
  }'
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| emailNotifications | boolean | No | Enable email notifications |
| scanNotifications | boolean | No | Enable scan notifications |
| reportNotifications | boolean | No | Enable report notifications |

#### Response

**Status: 200 OK**

```json
{
  "status": "success",
  "data": {
    "emailNotifications": true,
    "scanNotifications": false,
    "reportNotifications": true
  },
  "message": "Notification settings updated successfully"
}
```

---

### PATCH /settings/privacy

Update pengaturan privasi.

**Authentication:** Required

#### Request

```bash
curl -X PATCH http://localhost:3000/api/v1/patient/settings/privacy \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "dataVisibility": "restricted_self_only"
  }'
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| dataVisibility | string | No | Data visibility level (restricted_clinical_team_only, restricted_self_only, shared_with_clinic) |

#### Response

**Status: 200 OK**

```json
{
  "status": "success",
  "data": {
    "dataVisibility": "restricted_self_only"
  },
  "message": "Privacy settings updated successfully"
}
```

---

### PATCH /settings/preferences

Update preferensi umum (bahasa, tema, dll).

**Authentication:** Required

#### Request

```bash
curl -X PATCH http://localhost:3000/api/v1/patient/settings/preferences \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "English (US)",
    "theme": "dark"
  }'
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| language | string | No | Bahasa aplikasi |
| theme | string | No | Tema UI (light, dark) |

#### Response

**Status: 200 OK**

```json
{
  "status": "success",
  "data": {
    "language": "English (US)",
    "theme": "dark"
  },
  "message": "Preferences updated successfully"
}
```

---

## Notifications

### GET /notifications

Mendapatkan notifikasi pasien dengan pagination.

**Authentication:** Required  
**Query Parameters:** page (default: 1), limit (default: 10), sortBy, order

#### Request

```bash
curl -X GET "http://localhost:3000/api/v1/patient/notifications?page=1&limit=10" \
  -H "Authorization: Bearer {token}"
```

#### Response

**Status: 200 OK**

```json
{
  "status": "success",
  "data": [
    {
      "id": "notif-uuid-1",
      "notificationId": "PN-1234567890",
      "patientId": "patient-prof-uuid",
      "title": "Scan Analysis Complete",
      "message": "Your scan has been analyzed",
      "type": "scan_completed",
      "relatedScanId": "scan-uuid-1",
      "isRead": false,
      "readAt": null,
      "createdAt": "2025-05-10T10:35:00Z",
      "updatedAt": "2025-05-10T10:35:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "pages": 1
  }
}
```

---

### PATCH /notifications/{notificationId}/read

Mark notification sebagai sudah dibaca.

**Authentication:** Required

#### Request

```bash
curl -X PATCH http://localhost:3000/api/v1/patient/notifications/PN-1234567890/read \
  -H "Authorization: Bearer {token}"
```

#### Response

**Status: 200 OK**

```json
{
  "status": "success",
  "data": {
    "id": "notif-uuid-1",
    "notificationId": "PN-1234567890",
    "isRead": true,
    "readAt": "2025-05-10T10:40:00Z"
  },
  "message": "Notification marked as read"
}
```

---

### PATCH /notifications/read-all

Mark semua notifikasi sebagai sudah dibaca.

**Authentication:** Required

#### Request

```bash
curl -X PATCH http://localhost:3000/api/v1/patient/notifications/read-all \
  -H "Authorization: Bearer {token}"
```

#### Response

**Status: 200 OK**

```json
{
  "status": "success",
  "data": {
    "message": "5 notifications marked as read"
  }
}
```

---

## Doctors & Verification

### GET /doctors/available

Mendapatkan daftar dokter yang tersedia.

**Authentication:** Required

#### Request

```bash
curl -X GET http://localhost:3000/api/v1/patient/doctors/available \
  -H "Authorization: Bearer {token}"
```

#### Response

**Status: 200 OK**

```json
{
  "status": "success",
  "data": [
    {
      "id": "doctor-user-uuid-1",
      "name": "Dr. Elena Aris",
      "email": "elena@mail.com",
      "phone": "+6281234567",
      "avatarUrl": "/uploads/doctors/elena.jpg"
    },
    {
      "id": "doctor-user-uuid-2",
      "name": "Dr. Muhammad Rizki",
      "email": "rizki@mail.com",
      "phone": "+6281234568",
      "avatarUrl": "/uploads/doctors/rizki.jpg"
    }
  ]
}
```

---

### POST /verification-requests

Submit request untuk verifikasi dokter terhadap scans pasien.

**Authentication:** Required

#### Request

```bash
curl -X POST http://localhost:3000/api/v1/patient/verification-requests \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I have a concerning mole on my back that has changed size and color. Please review my recent scans and provide professional assessment."
  }'
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| message | string | Yes | Reason for verification request (min 10 chars) |

#### Response

**Status: 201 Created**

```json
{
  "status": "success",
  "data": {
    "requestId": "VER-1234567890",
    "status": "pending",
    "submittedAt": "2025-05-10T15:20:00Z",
    "message": "Verification request submitted successfully"
  }
}
```

---

## Error Responses

Semua error response mengikuti format berikut:

```json
{
  "status": "error",
  "message": "Error description"
}
```

### Common Status Codes

| Status | Description |
|--------|-------------|
| 200 | Success (GET, PATCH) |
| 201 | Created (POST) |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 500 | Internal Server Error |

### Example Error Responses

**400 Bad Request - Missing required field**
```json
{
  "status": "error",
  "message": "Image file is required"
}
```

**401 Unauthorized - Missing token**
```json
{
  "status": "error",
  "message": "Akses ditolak, token tidak ditemukan"
}
```

**403 Forbidden - Insufficient role**
```json
{
  "status": "error",
  "message": "Akses ditolak. Endpoint ini hanya untuk Pasien."
}
```

**404 Not Found**
```json
{
  "status": "error",
  "message": "Scan not found or unauthorized"
}
```

---

## Summary Table

| Method | Endpoint | Authentication | Role | Description |
|--------|----------|-----------------|------|-------------|
| GET | /dashboard | ✓ | patient | Get patient overview |
| POST | /scans/upload | ✓ | patient | Upload lesion image |
| POST | /scans/{scanId}/analyze | ✓ | patient | Trigger AI analysis |
| GET | /scans/{scanId}/analysis | ✓ | patient | Get analysis results |
| GET | /scans/recent | ✓ | patient | Get recent scans |
| GET | /scans/history | ✓ | patient | Get scan history |
| GET | /scans/{scanId} | ✓ | patient | Get scan details |
| GET | /scans/{scanId}/export-pdf | ✓ | patient | Export scan as PDF |
| POST | /scans/{scanId}/share | ✓ | patient | Share scan with doctor |
| GET | /reports | ✓ | patient | Get patient reports |
| GET | /reports/{reportId} | ✓ | patient | Get report details |
| GET | /reports/{reportId}/download | ✓ | patient | Download report PDF |
| GET | /reports/{reportId}/preview | ✓ | patient | Preview report |
| GET | /profile | ✓ | patient | Get patient profile |
| PATCH | /profile | ✓ | patient | Update profile |
| PATCH | /profile/photo | ✓ | patient | Update profile photo |
| GET | /settings | ✓ | patient | Get all settings |
| PATCH | /settings/account | ✓ | patient | Update account settings |
| PATCH | /settings/2fa | ✓ | patient | Update 2FA settings |
| PATCH | /settings/notifications | ✓ | patient | Update notification settings |
| PATCH | /settings/privacy | ✓ | patient | Update privacy settings |
| PATCH | /settings/preferences | ✓ | patient | Update preferences |
| GET | /notifications | ✓ | patient | Get notifications |
| PATCH | /notifications/{notificationId}/read | ✓ | patient | Mark notification as read |
| PATCH | /notifications/read-all | ✓ | patient | Mark all as read |
| GET | /doctors/available | ✓ | patient | Get available doctors |
| POST | /verification-requests | ✓ | patient | Submit verification request |

---

## Integration Notes

### Pagination

Semua endpoint yang mengembalikan list support pagination dengan parameter:
- `page`: Page number (default: 1, min: 1)
- `limit`: Items per page (default: 10, max: 100)
- `sortBy`: Field to sort by (default: createdAt)
- `order`: Sort order (default: desc, values: asc|desc)

### File Upload

File upload menggunakan `multipart/form-data`:
- **Scans**: Max 10MB (JPEG, PNG, WebP)
- **Profile Photo**: Max 5MB (JPEG, PNG, WebP)

### Authentication

Semua request memerlukan JWT token dalam header:
```
Authorization: Bearer {token}
```

Token diperoleh dari endpoint `/api/auth/login` dengan credentials pasien.

### Rate Limiting

API implements rate limiting per endpoint. Dashboard: 10/minute, Others: 30/minute

---

## Development Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Update DATABASE_URL dan JWT_SECRET

# Run migrations
npx prisma migrate dev

# Seed data
npx prisma db seed
node prisma/seed-patient.js

# Start server
npm run dev
```

---

**Last Updated:** May 12, 2025  
**API Version:** v1
