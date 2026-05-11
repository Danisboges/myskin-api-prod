# Doctor Dashboard API Documentation

## Base URL
```
http://localhost:3000/api/v1/doctor
```

## Authentication
All endpoints require a valid JWT token in the `Authorization` header:
```
Authorization: Bearer <jwt_token>
```

## Status Codes
- `200`: Success GET/PATCH request
- `201`: Success POST request
- `400`: Validation error
- `401`: Unauthorized (missing/invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Resource not found
- `500`: Server error

---

## Endpoints

### 1. DASHBOARD

#### 1.1 Get Dashboard Summary
```http
GET /dashboard/summary
```

**Response Example:**
```json
{
  "status": "success",
  "data": {
    "totalRequests": 1284,
    "pendingReview": 42,
    "completedScans": 1242,
    "accuracy": 98,
    "growthPercentage": 12
  }
}
```

---

#### 1.2 Get Assigned Cases
```http
GET /cases/assigned
```

**Response Example:**
```json
{
  "status": "success",
  "data": [
    {
      "caseId": "SK-9921",
      "patientName": "Sarah Johnson",
      "patientAge": 42,
      "patientGender": "Female",
      "receivedAt": "2026-04-22T10:30:00Z",
      "status": "pending_review",
      "avatarUrl": "/uploads/patients/sarah-johnson.png"
    }
  ]
}
```

---

#### 1.3 Get Case Details
```http
GET /cases/{caseId}
```

**Parameters:**
- `caseId` (string, required): Case ID (e.g., SK-9921)

**Response Example:**
```json
{
  "status": "success",
  "data": {
    "caseId": "SK-9921",
    "patient": {
      "id": "P-001",
      "name": "Sarah Johnson",
      "age": 42,
      "gender": "Female"
    },
    "clinicalImage": {
      "imageUrl": "/uploads/cases/sk-9921-lesion.png",
      "zoom": "4.0x",
      "light": "Polarized",
      "bodySite": "Left Shoulder"
    },
    "aiPrediction": {
      "confidence": "HIGH CONFIDENCE",
      "predictions": [
        {
          "label": "Melanocytic Nevus",
          "percentage": 88
        },
        {
          "label": "Seborrheic Keratosis",
          "percentage": 7
        },
        {
          "label": "Malignant Melanoma",
          "percentage": 5
        }
      ]
    },
    "patientNotes": "Noticed this spot changing color over the last 3 months.",
    "physicianObservation": "",
    "status": "pending_review",
    "receivedAt": "2026-04-22T10:30:00Z"
  }
}
```

---

#### 1.4 Save Physician Observation
```http
POST /cases/{caseId}/observation
```

**Parameters:**
- `caseId` (string, required): Case ID

**Request Body:**
```json
{
  "physicianObservation": "The lesion appears consistent with benign melanocytic nevus."
}
```

**Response Example:**
```json
{
  "status": "success",
  "message": "Observation saved successfully"
}
```

---

#### 1.5 Approve Case
```http
PATCH /cases/{caseId}/approve
```

**Parameters:**
- `caseId` (string, required): Case ID

**Request Body:**
```json
{
  "physicianObservation": "The lesion appears consistent with benign melanocytic nevus.",
  "finalDiagnosis": "Melanocytic Nevus"
}
```

**Response Example:**
```json
{
  "status": "success",
  "message": "Case approved successfully",
  "data": {
    "caseId": "SK-9921"
  }
}
```

---

#### 1.6 Reject Case
```http
PATCH /cases/{caseId}/reject
```

**Parameters:**
- `caseId` (string, required): Case ID

**Request Body:**
```json
{
  "reason": "False positive prediction",
  "physicianObservation": "AI prediction does not match clinical features.",
  "finalDiagnosis": "Seborrheic Keratosis"
}
```

**Response Example:**
```json
{
  "status": "success",
  "message": "Case rejected successfully",
  "data": {
    "caseId": "SK-9921"
  }
}
```

---

### 2. CASE HISTORY

#### 2.1 Get Case History with Filters
```http
GET /cases/history?search=sarah&diagnosis=melanoma&status=verified&startDate=2026-04-01&endDate=2026-04-30&page=1&limit=10
```

**Query Parameters:**
- `search` (string, optional): Search by patient name or case ID
- `diagnosis` (string, optional): Filter by diagnosis
- `status` (string, optional): Filter by status (pending_review, approved, rejected, under_review)
- `startDate` (string, optional): Start date (YYYY-MM-DD)
- `endDate` (string, optional): End date (YYYY-MM-DD)
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Results per page (default: 10)

**Response Example:**
```json
{
  "status": "success",
  "data": [
    {
      "caseId": "SK-9921",
      "date": "2026-04-22",
      "patient": {
        "id": "P-001",
        "name": "Sarah Johnson"
      },
      "clinicalImageUrl": "/uploads/cases/sk-9921-lesion.png",
      "aiDiagnosis": "Melanocytic Nevus",
      "verificationStatus": "approved"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 128
  }
}
```

---

#### 2.2 Get Patient Lesion Evolution
```http
GET /patients/{patientId}/evolution
```

**Parameters:**
- `patientId` (string, required): Patient ID (e.g., P-001)

**Response Example:**
```json
{
  "status": "success",
  "data": {
    "patient": {
      "id": "P-001",
      "name": "Sarah Johnson",
      "age": 42,
      "gender": "Female"
    },
    "evolution": [
      {
        "scanId": "SCAN-003",
        "date": "2026-04-22",
        "imageUrl": "/uploads/evolution/april.png",
        "note": "High vascularity detected at periphery.",
        "growthPercentage": 12
      },
      {
        "scanId": "SCAN-002",
        "date": "2026-02-15",
        "imageUrl": "/uploads/evolution/february.png",
        "note": "Previous scan."
      },
      {
        "scanId": "SCAN-001",
        "date": "2025-12-10",
        "imageUrl": "/uploads/evolution/december.png",
        "note": "Baseline scan."
      }
    ]
  }
}
```

---

### 3. PROFILE

#### 3.1 Get Doctor Profile
```http
GET /profile
```

**Response Example:**
```json
{
  "status": "success",
  "data": {
    "doctorId": "MS-9942",
    "fullName": "Dr. Elena Aris",
    "email": "elenaaris@icloud.com",
    "gender": "Female",
    "role": "doctor",
    "phoneNumber": "+628134567890",
    "birthDate": "1996-04-23",
    "joinedAt": "2023-10-01",
    "profileImageUrl": "/uploads/doctors/elena.png",
    "practitionerStatus": {
      "status": "verified",
      "label": "Verified Doctor",
      "description": "Your medical license and clinical specialization have been verified for Melanoma AI analysis."
    }
  }
}
```

---

#### 3.2 Update Doctor Profile
```http
PATCH /profile
```

**Request Body:**
```json
{
  "fullName": "Dr. Elena Aris",
  "phoneNumber": "+628134567890",
  "gender": "Female",
  "birthDate": "1996-04-23"
}
```

**Response Example:**
```json
{
  "status": "success",
  "message": "Profile updated successfully"
}
```

---

#### 3.3 Update Profile Photo
```http
PATCH /profile/photo
```

**Request Type:** `multipart/form-data`

**Parameters:**
- `photo` (file, required): Image file

**Response Example:**
```json
{
  "status": "success",
  "message": "Profile photo updated successfully",
  "data": {
    "imageUrl": "/uploads/doctors/elena-new.png"
  }
}
```

---

### 4. SETTINGS

#### 4.1 Get All Settings
```http
GET /settings
```

**Response Example:**
```json
{
  "status": "success",
  "data": {
    "account": {
      "email": "elenaaris@icloud.com",
      "twoFactorEnabled": true
    },
    "notifications": {
      "emailNotifications": true,
      "verificationAlerts": false
    },
    "privacy": {
      "dataVisibility": "restricted_clinical_team_only"
    },
    "preferences": {
      "language": "English (US)"
    }
  }
}
```

---

#### 4.2 Update Account Settings
```http
PATCH /settings/account
```

**For Email Update:**
```json
{
  "email": "newemail@icloud.com"
}
```

**For Password Update:**
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword123"
}
```

**Response Example:**
```json
{
  "status": "success",
  "message": "Account settings updated successfully"
}
```

---

#### 4.3 Update 2FA Settings
```http
PATCH /settings/2fa
```

**Request Body:**
```json
{
  "enabled": true
}
```

**Response Example:**
```json
{
  "status": "success",
  "message": "Two-factor authentication enabled"
}
```

---

#### 4.4 Update Notification Settings
```http
PATCH /settings/notifications
```

**Request Body:**
```json
{
  "emailNotifications": true,
  "verificationAlerts": false
}
```

**Response Example:**
```json
{
  "status": "success",
  "message": "Notification settings updated successfully"
}
```

---

#### 4.5 Update Privacy Settings
```http
PATCH /settings/privacy
```

**Request Body:**
```json
{
  "dataVisibility": "restricted_clinical_team_only"
}
```

**Valid Values:**
- `restricted_clinical_team_only`: Only accessible to clinical team
- `restricted_self_only`: Only accessible to self
- `shared_with_clinic`: Shared with entire clinic

**Response Example:**
```json
{
  "status": "success",
  "message": "Privacy settings updated successfully"
}
```

---

#### 4.6 Update Preferences
```http
PATCH /settings/preferences
```

**Request Body:**
```json
{
  "language": "English (US)"
}
```

**Response Example:**
```json
{
  "status": "success",
  "message": "Preferences updated successfully"
}
```

---

### 5. NOTIFICATIONS

#### 5.1 Get Doctor Notifications
```http
GET /notifications
```

**Response Example:**
```json
{
  "status": "success",
  "unreadCount": 2,
  "data": [
    {
      "notificationId": "N-001",
      "title": "You have a patient waiting",
      "message": "A patient is waiting for your attention.",
      "type": "case_request",
      "isRead": false,
      "createdAt": "2026-04-25T10:30:00Z"
    },
    {
      "notificationId": "N-002",
      "title": "New scan analysis complete",
      "message": "Scan #8421 is ready for review.",
      "type": "scan_complete",
      "isRead": false,
      "createdAt": "2026-04-25T09:45:00Z"
    }
  ]
}
```

**Notification Types:**
- `case_request`: New case assignment
- `scan_complete`: Scan analysis ready
- `verification_alert`: Verification status update
- `system_message`: System notifications

---

#### 5.2 Mark Notification as Read
```http
PATCH /notifications/{notificationId}/read
```

**Parameters:**
- `notificationId` (string, required): Notification ID (e.g., N-001)

**Response Example:**
```json
{
  "status": "success",
  "message": "Notification marked as read"
}
```

---

#### 5.3 Mark All Notifications as Read
```http
PATCH /notifications/read-all
```

**Response Example:**
```json
{
  "status": "success",
  "message": "All notifications marked as read"
}
```

---

## Error Responses

### 400 - Bad Request
```json
{
  "status": "error",
  "message": "physicianObservation is required"
}
```

### 401 - Unauthorized
```json
{
  "status": "error",
  "message": "Akses ditolak, token tidak ditemukan"
}
```

### 403 - Forbidden
```json
{
  "status": "error",
  "message": "Akses ditolak. Endpoint ini hanya untuk Dokter."
}
```

### 404 - Not Found
```json
{
  "status": "error",
  "message": "Case not found"
}
```

### 500 - Server Error
```json
{
  "status": "error",
  "message": "Failed to get dashboard summary: [error details]"
}
```

---

## Test Credentials

### Doctor Account
- **Email:** elenaaris@icloud.com
- **Password:** password123
- **Role:** doctor

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "elenaaris@icloud.com",
    "password": "password123"
  }'
```

You will receive a JWT token in the response, which you can use for all subsequent requests.

---

## Implementation Summary

### Files Created/Modified:
1. **Prisma Schema** (`prisma/schema.prisma`):
   - Added CaseReviewStatus, NotificationType, DataVisibility enums
   - Added DoctorProfile, CaseReview, CaseAssignment, DoctorObservation, DoctorSettings, Notification models

2. **Services** (`src/services/doctor.service.js`):
   - Dashboard services (summary, assigned cases, case details)
   - Case management (observations, approvals, rejections)
   - Case history with filters and pagination
   - Patient evolution tracking
   - Doctor profile management
   - Settings management
   - Notification handling

3. **Controllers** (`src/controllers/doctor.controller.js`):
   - All endpoint handlers with validation
   - Proper error handling and status codes
   - Request body validation

4. **Routes** (`src/routes/doctor.route.js`):
   - RESTful endpoint definitions
   - Auth middleware integration
   - File upload middleware for profile photos

5. **Middleware** (`src/middlewares/auth.middleware.js`):
   - Added `isDoctor` middleware for role-based access

6. **Seeder** (`prisma/seed-doctor.js`):
   - Creates sample doctor users
   - Creates doctor profiles and settings
   - Creates sample case reviews
   - Creates notifications and assignments

### Database Schema:
- **DoctorProfile**: Extended user profile for doctors
- **CaseReview**: Tracks AI predictions and doctor reviews
- **CaseAssignment**: Links doctors to cases
- **DoctorObservation**: Tracks physician notes
- **DoctorSettings**: User preferences and settings
- **Notification**: System notifications for doctors

### Features:
✅ JWT Authentication & Authorization
✅ Role-based access control (Doctor only)
✅ Case assignment and review workflow
✅ Doctor profile management
✅ Settings management (account, 2FA, notifications, privacy, preferences)
✅ Notification system
✅ Case history with pagination and filters
✅ Patient evolution tracking
✅ File upload (profile photos)
✅ Proper error handling and status codes
✅ Validation for all inputs

---

## Next Steps

1. **Run Migrations:**
   ```bash
   npx prisma migrate dev --name "add_doctor_dashboard"
   ```

2. **Run Seeder:**
   ```bash
   node prisma/seed-doctor.js
   ```

3. **Start Server:**
   ```bash
   npm run dev
   ```

4. **Test Endpoints:**
   Use Postman or your favorite API client with the provided test credentials.
