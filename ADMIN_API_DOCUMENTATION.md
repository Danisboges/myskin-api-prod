# ADMIN API DOCUMENTATION

## Overview
Complete admin management API for Melanoma Detection System. All endpoints require JWT authentication and admin role authorization.

---

## Table of Contents
1. [Dashboard Endpoints](#dashboard-endpoints)
2. [User Management Endpoints](#user-management-endpoints)
3. [Doctor Management Endpoints](#doctor-management-endpoints)
4. [Profile Endpoints](#profile-endpoints)
5. [Settings Endpoints](#settings-endpoints)
6. [Notification Endpoints](#notification-endpoints)
7. [Audit Log Endpoints](#audit-log-endpoints)
8. [Detection Case Endpoints](#detection-case-endpoints)

---

## Authentication
All endpoints require JWT token in Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

### Test Admin Credentials
- Email: `admin@mail.com`
- Password: `password123`

---

## Dashboard Endpoints

### 1. Get Dashboard Summary
**GET** `/api/v1/admin/dashboard/summary`

Returns overall system statistics.

**Response:**
```json
{
  "status": "success",
  "data": {
    "totalUsers": 14285,
    "totalUsersGrowth": 12.5,
    "activeSessions": 842,
    "storageUsage": {
      "percentage": 78,
      "used": "4.2 TB",
      "total": "5.0 TB"
    },
    "averageDetectionAccuracy": 96.4,
    "accuracyGrowth": 0.2
  }
}
```

---

### 2. Get User Growth Data
**GET** `/api/v1/admin/dashboard/user-growth`

Get user growth chart data.

**Query Parameters:**
- `range` (optional): "7d" | "30d" | "90d" | "1y" (default: "30d")

**Response:**
```json
{
  "status": "success",
  "data": {
    "range": "30d",
    "data": [
      {
        "label": "Week 1",
        "users": 2500
      },
      {
        "label": "Week 2",
        "users": 5200
      }
    ]
  }
}
```

---

### 3. Get Role Distribution
**GET** `/api/v1/admin/dashboard/role-distribution`

Get distribution of users by role.

**Response:**
```json
{
  "status": "success",
  "data": {
    "data": [
      {
        "role": "patient",
        "label": "Patients",
        "percentage": 65,
        "total": 9285
      },
      {
        "role": "doctor",
        "label": "Doctors",
        "percentage": 25,
        "total": 3571
      },
      {
        "role": "admin",
        "label": "Admins",
        "percentage": 10,
        "total": 1429
      }
    ]
  }
}
```

---

### 4. Get System Logs
**GET** `/api/v1/admin/system/logs`

Get system activity logs with filtering.

**Query Parameters:**
- `type` (optional): Log type/category
- `severity` (optional): "critical" | "warning" | "info"
- `page` (optional, default: 1)
- `limit` (optional, default: 10)

**Response:**
```json
{
  "status": "success",
  "data": {
    "data": [
      {
        "logId": "LOG-001",
        "title": "Storage Capacity Warning",
        "description": "Image repository DB-East-1 has exceeded 90% capacity threshold.",
        "severity": "critical",
        "category": "infrastructure",
        "createdAt": "2026-04-22T10:30:00Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 120,
      "totalPages": 12
    }
  }
}
```

---

### 5. Generate Report
**POST** `/api/v1/admin/dashboard/report/generate`

Generate system report for specified date range.

**Request Body:**
```json
{
  "startDate": "2026-04-01",
  "endDate": "2026-04-30",
  "reportType": "system_overview",
  "format": "pdf"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Report generated successfully",
  "data": {
    "reportId": "RPT-1650616200000",
    "startDate": "2026-04-01",
    "endDate": "2026-04-30",
    "reportType": "system_overview",
    "format": "pdf",
    "generatedAt": "2026-04-22T10:30:00Z"
  }
}
```

---

### 6. Export Report
**GET** `/api/v1/admin/dashboard/report/export`

Export generated report.

**Query Parameters:**
- `startDate` (required): Start date
- `endDate` (required): End date
- `reportType` (required): Report type
- `format` (required): "pdf" | "csv" | "xlsx"

**Response:**
```json
{
  "status": "success",
  "data": {
    "message": "Report exported successfully",
    "downloadUrl": "/api/v1/admin/dashboard/reports/1650616200000.pdf",
    "format": "pdf"
  }
}
```

---

## User Management Endpoints

### 1. Get All Users
**GET** `/api/v1/admin/users`

Retrieve list of all users with filtering.

**Query Parameters:**
- `search` (optional): Search by name or email
- `role` (optional): "all" | "admin" | "doctor" | "patient" (default: "all")
- `status` (optional): "active" | "pending" | "suspended" | "inactive"
- `page` (optional, default: 1)
- `limit` (optional, default: 8, max: 100)
- `sortBy` (optional): Field to sort by (default: "createdAt")
- `sortOrder` (optional): "asc" | "desc" (default: "desc")

**Example:**
```
GET /api/v1/admin/users?role=doctor&status=active&page=1&limit=8
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "data": [
      {
        "userId": "uuid-123",
        "fullName": "Dr. Elena Aris",
        "role": "doctor",
        "email": "elenaaris@icloud.com",
        "status": "active",
        "gender": "Female",
        "phoneNumber": "+628134567890",
        "birthDate": "1996-04-23T00:00:00Z",
        "avatarUrl": "/uploads/users/elena.png",
        "createdAt": "2024-01-12T00:00:00Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 8,
      "total": 1240,
      "totalPages": 155
    }
  }
}
```

---

### 2. Get User Detail
**GET** `/api/v1/admin/users/:userId`

Get detailed information about a specific user.

**Response:**
```json
{
  "status": "success",
  "data": {
    "userId": "uuid-123",
    "fullName": "Dr. Elena Aris",
    "role": "doctor",
    "email": "elenaaris@icloud.com",
    "status": "active",
    "gender": "Female",
    "phoneNumber": "+628134567890",
    "birthDate": "1996-04-23T00:00:00Z",
    "avatarUrl": "/uploads/users/elena.png",
    "joinedAt": "2024-01-12T00:00:00Z"
  }
}
```

---

### 3. Create New User
**POST** `/api/v1/admin/users`

Create a new user account.

**Request Body:**
```json
{
  "fullName": "Dr. Helena Troy",
  "email": "h.troy@clinical-atelier.com",
  "password": "password123",
  "role": "doctor",
  "gender": "Female",
  "phoneNumber": "+628134567890",
  "birthDate": "1996-04-23"
}
```

**Response:**
```json
{
  "message": "User created successfully",
  "data": {
    "userId": "uuid-456",
    "fullName": "Dr. Helena Troy",
    "role": "doctor",
    "email": "h.troy@clinical-atelier.com",
    "status": "pending"
  }
}
```

**Status Code:** 201

---

### 4. Update User
**PATCH** `/api/v1/admin/users/:userId`

Update user profile information.

**Request Body:**
```json
{
  "fullName": "Dr. Elena Aris Updated",
  "email": "elenaaris.new@icloud.com",
  "phoneNumber": "+628134567890",
  "birthDate": "1996-04-23",
  "gender": "Female"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "User updated successfully"
}
```

---

### 5. Update User Status
**PATCH** `/api/v1/admin/users/:userId/status`

Change user account status.

**Request Body:**
```json
{
  "status": "active"
}
```

**Allowed Status:** "active" | "pending" | "suspended" | "inactive"

**Response:**
```json
{
  "status": "success",
  "message": "User status updated successfully"
}
```

---

### 6. Change User Role
**PATCH** `/api/v1/admin/users/:userId/role`

Change user role.

**Request Body:**
```json
{
  "role": "doctor"
}
```

**Allowed Roles:** "admin" | "doctor" | "patient"

**Response:**
```json
{
  "status": "success",
  "message": "User role changed successfully"
}
```

---

### 7. Reset User Password
**PATCH** `/api/v1/admin/users/:userId/reset-password`

Admin can reset user password.

**Request Body:**
```json
{
  "newPassword": "newPassword123"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Password reset successfully"
}
```

---

### 8. Delete User
**DELETE** `/api/v1/admin/users/:userId`

Soft delete user (sets status to inactive).

**Response:**
```json
{
  "status": "success",
  "message": "User deleted successfully"
}
```

---

## Doctor Management Endpoints

### 1. Get Doctors Summary
**GET** `/api/v1/admin/doctors/summary`

Get medical team overview statistics.

**Response:**
```json
{
  "status": "success",
  "data": {
    "totalClinicians": 124,
    "totalCliniciansGrowth": 12,
    "pendingApprovals": 8,
    "patientThroughput": 1402,
    "patientThroughputLabel": "Avg / Mo"
  }
}
```

---

### 2. Get All Doctors
**GET** `/api/v1/admin/doctors`

Retrieve list of all doctors.

**Query Parameters:**
- `search` (optional): Search by name or email
- `status` (optional): "active" | "pending" | "verified" | "rejected" | "suspended"
- `page` (optional, default: 1)
- `limit` (optional, default: 8)

**Response:**
```json
{
  "status": "success",
  "data": {
    "data": [
      {
        "doctorId": "SKN-2041",
        "fullName": "Dr. Elena Aris",
        "email": "elenaaris@icloud.com",
        "registrationDate": "2024-01-12",
        "patientLoad": 15,
        "status": "verified",
        "avatarUrl": "/uploads/doctors/elena.png"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 8,
      "total": 124
    }
  }
}
```

---

### 3. Get Doctor Detail
**GET** `/api/v1/admin/doctors/:doctorId`

Get detailed information about a doctor.

**Response:**
```json
{
  "status": "success",
  "data": {
    "doctorId": "SKN-2041",
    "fullName": "Dr. Elena Aris",
    "email": "elenaaris@icloud.com",
    "gender": "Female",
    "phoneNumber": "+628134567890",
    "specialization": "Senior Dermatologist",
    "registrationDate": "2024-01-12T00:00:00Z",
    "status": "verified",
    "patientLoad": 15,
    "avatarUrl": "/uploads/doctors/elena.png"
  }
}
```

---

### 4. Get Doctor Verification Requests
**GET** `/api/v1/admin/doctors/:doctorId/verification-requests`

Get list of cases assigned to a doctor.

**Response:**
```json
{
  "status": "success",
  "data": {
    "doctor": {
      "doctorId": "SKN-2041",
      "fullName": "Dr. Elena Aris"
    },
    "data": [
      {
        "requestId": "VR-001",
        "patientName": "Sarah Johnson",
        "patientId": "uuid-789",
        "date": "2024-01-12T00:00:00Z",
        "aiDiagnosis": "60% Malignant Melanoma",
        "caseId": "CASE-001"
      }
    ]
  }
}
```

---

### 5. Approve Doctor
**PATCH** `/api/v1/admin/doctors/:doctorId/approve`

Approve a doctor's application.

**Request Body:**
```json
{
  "note": "Doctor license has been verified."
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Doctor approval request accepted"
}
```

---

### 6. Reject Doctor
**PATCH** `/api/v1/admin/doctors/:doctorId/reject`

Reject a doctor's application.

**Request Body:**
```json
{
  "reason": "Medical license document is invalid or incomplete."
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Doctor approval request rejected"
}
```

---

## Profile Endpoints

### 1. Get Admin Profile
**GET** `/api/v1/admin/profile`

Get current admin's profile information.

**Response:**
```json
{
  "status": "success",
  "data": {
    "adminId": "uuid-123",
    "fullName": "Aryo Jaty",
    "email": "aryojaty@icloud.com",
    "gender": "Male",
    "role": "Administrator",
    "phoneNumber": "+628134567890",
    "birthDate": "1996-04-23T00:00:00Z",
    "joinedAt": "2023-10-01T00:00:00Z",
    "profileImageUrl": "/uploads/admins/aryo.png",
    "administratorStatus": {
      "status": "verified",
      "label": "Verified Administrator",
      "description": "Your administrator access for the MySkin platform has been verified to manage and oversee Melanoma AI analysis."
    }
  }
}
```

---

### 2. Update Admin Profile
**PATCH** `/api/v1/admin/profile`

Update admin profile information.

**Request Body:**
```json
{
  "fullName": "Aryo Jaty",
  "phoneNumber": "+628134567890",
  "gender": "Male",
  "birthDate": "1996-04-23"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Admin profile updated successfully"
}
```

---

### 3. Update Admin Photo
**PATCH** `/api/v1/admin/profile/photo`

Upload new admin profile photo.

**Request:**
- Content-Type: multipart/form-data
- Field: `photo` (file)

**Response:**
```json
{
  "status": "success",
  "data": {
    "photoUrl": "/uploads/aryo.png",
    "message": "Admin photo updated successfully"
  }
}
```

---

### 4. Get Verification Status
**GET** `/api/v1/admin/verification-status`

Get admin's verification status.

**Response:**
```json
{
  "status": "success",
  "data": {
    "status": "verified",
    "label": "Verified Administrator",
    "description": "Your administrator access for the MySkin platform has been verified to manage and oversee Melanoma AI analysis."
  }
}
```

---

## Settings Endpoints

### 1. Get All Settings
**GET** `/api/v1/admin/settings`

Get admin's all settings.

**Response:**
```json
{
  "status": "success",
  "data": {
    "account": {
      "email": "aryojaty@icloud.com",
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

### 2. Update Account Settings
**PATCH** `/api/v1/admin/settings/account`

Update email or password.

**Request Body (Update Email):**
```json
{
  "email": "newemail@icloud.com"
}
```

**Request Body (Update Password):**
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword123"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Account settings updated successfully"
}
```

---

### 3. Update 2FA Settings
**PATCH** `/api/v1/admin/settings/2fa`

Enable/disable two-factor authentication.

**Request Body:**
```json
{
  "enabled": true
}
```

**Response:**
```json
{
  "status": "success",
  "message": "2FA settings updated successfully"
}
```

---

### 4. Update Notification Settings
**PATCH** `/api/v1/admin/settings/notifications`

Update notification preferences.

**Request Body:**
```json
{
  "emailNotifications": true,
  "verificationAlerts": false
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Notification settings updated successfully"
}
```

---

### 5. Update Privacy Settings
**PATCH** `/api/v1/admin/settings/privacy`

Update data visibility.

**Request Body:**
```json
{
  "dataVisibility": "restricted_clinical_team_only"
}
```

**Allowed Values:** "restricted_clinical_team_only" | "restricted_self_only" | "shared_with_clinic"

**Response:**
```json
{
  "status": "success",
  "message": "Privacy settings updated successfully"
}
```

---

### 6. Update Preferences
**PATCH** `/api/v1/admin/settings/preferences`

Update system preferences.

**Request Body:**
```json
{
  "language": "English (US)"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Preferences updated successfully"
}
```

---

## Notification Endpoints

### 1. Get Notifications
**GET** `/api/v1/admin/notifications`

Get admin's notifications.

**Response:**
```json
{
  "status": "success",
  "data": {
    "unreadCount": 3,
    "data": [
      {
        "notificationId": "N-001",
        "title": "New doctor approval request",
        "message": "A new doctor account is waiting for verification.",
        "type": "doctor_approval",
        "isRead": false,
        "createdAt": "2026-04-22T10:30:00Z"
      }
    ]
  }
}
```

---

### 2. Mark Notification as Read
**PATCH** `/api/v1/admin/notifications/:notificationId/read`

Mark a single notification as read.

**Response:**
```json
{
  "status": "success",
  "message": "Notification marked as read"
}
```

---

### 3. Mark All Notifications as Read
**PATCH** `/api/v1/admin/notifications/read-all`

Mark all notifications as read.

**Response:**
```json
{
  "status": "success",
  "message": "All notifications marked as read"
}
```

---

## Audit Log Endpoints

### 1. Get Audit Logs
**GET** `/api/v1/admin/audit-logs`

Get system audit logs.

**Query Parameters:**
- `adminId` (optional): Filter by admin ID
- `action` (optional): Filter by action type
- `startDate` (optional): Start date for filtering
- `endDate` (optional): End date for filtering
- `page` (optional, default: 1)
- `limit` (optional, default: 10)

**Response:**
```json
{
  "status": "success",
  "data": {
    "data": [
      {
        "auditId": "AUD-001",
        "adminId": "uuid-123",
        "adminName": "Aryo Jaty",
        "action": "CREATE_USER",
        "description": "Admin created new doctor account Dr. Helena Troy.",
        "ipAddress": "192.168.1.10",
        "createdAt": "2026-04-22T10:30:00Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 200
    }
  }
}
```

---

## Detection Case Endpoints

### 1. Submit Detection as Case
**POST** `/api/detection/cases/:detectionId/submit/:doctorId`

Submit a detection result as a case to a doctor.

**Request Body:**
```json
{
  "notes": "Patient reports itching and color changes on the spot"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Case submitted to doctor successfully",
  "data": {
    "caseId": "CASE-1650616200000",
    "doctorId": "SKN-2041",
    "doctorName": "Dr. Elena Aris",
    "status": "pending_review",
    "submittedAt": "2026-04-22T10:30:00Z"
  }
}
```

---

### 2. Get Patient Cases
**GET** `/api/detection/my-cases`

Get all cases submitted by patient.

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 10)

**Response:**
```json
{
  "status": "success",
  "data": {
    "data": [
      {
        "caseId": "CASE-001",
        "patientName": "Sarah Johnson",
        "imageUrl": "/uploads/detections/sample.jpg",
        "aiDiagnosis": "87% Melanoma",
        "status": "pending_review",
        "assignedDoctor": {
          "doctorId": "SKN-2041",
          "name": "Dr. Elena Aris",
          "email": "elenaaris@icloud.com",
          "avatarUrl": "/uploads/doctors/elena.png"
        },
        "submittedAt": "2026-04-22T10:30:00Z",
        "reviewedAt": null
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

---

### 3. Get Doctor Assigned Cases
**GET** `/api/detection/doctor/:doctorId/cases`

Get cases assigned to a doctor.

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 10)

**Response:**
```json
{
  "status": "success",
  "data": {
    "data": [
      {
        "caseId": "CASE-001",
        "patientName": "Sarah Johnson",
        "patientGender": "female",
        "imageUrl": "/uploads/detections/sample.jpg",
        "aiDiagnosis": "87% Melanoma",
        "status": "pending_review",
        "submittedAt": "2026-04-22T10:30:00Z",
        "observationCount": 2,
        "reviewedAt": null
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 12,
      "totalPages": 2
    }
  }
}
```

---

### 4. Get Case Detail
**GET** `/api/detection/cases/:caseId`

Get detailed information about a case.

**Response:**
```json
{
  "status": "success",
  "data": {
    "caseId": "CASE-001",
    "patientName": "Sarah Johnson",
    "patientAge": 26,
    "patientGender": "female",
    "imageUrl": "/uploads/detections/sample.jpg",
    "aiDiagnosis": "87% Melanoma",
    "patientNotes": "Brown spot on my arm that looks suspicious",
    "status": "pending_review",
    "doctor": {
      "doctorId": "SKN-2041",
      "name": "Dr. Elena Aris",
      "email": "elenaaris@icloud.com",
      "avatarUrl": "/uploads/doctors/elena.png"
    },
    "doctorObservation": "Needs biopsy to confirm diagnosis",
    "finalDiagnosis": "Malignant Melanoma",
    "observations": [
      {
        "observationId": "OBS-001",
        "doctorName": "Dr. Elena Aris",
        "observation": "Asymmetrical shape and irregular borders",
        "createdAt": "2026-04-22T10:45:00Z"
      }
    ],
    "submittedAt": "2026-04-22T10:30:00Z",
    "reviewedAt": "2026-04-22T11:00:00Z"
  }
}
```

---

### 5. Submit Case Review
**POST** `/api/detection/cases/:caseId/review`

Submit doctor's review for a case.

**Request Body:**
```json
{
  "doctorId": "SKN-2041",
  "observation": "Asymmetrical shape and irregular borders indicate potential melanoma",
  "finalDiagnosis": "Malignant Melanoma",
  "status": "approved"
}
```

**Allowed Status:** "approved" | "rejected" | "under_review" | "pending_review"

**Response:**
```json
{
  "status": "success",
  "message": "Case review submitted successfully",
  "data": {
    "caseId": "CASE-001",
    "status": "approved",
    "reviewedAt": "2026-04-22T11:00:00Z"
  }
}
```

---

## Error Handling

All errors follow this format:

```json
{
  "status": "error",
  "message": "Error description",
  "errors": {
    "fieldName": "Field-specific error message"
  }
}
```

### Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success (GET/PATCH) |
| 201 | Success (POST) |
| 400 | Validation Error |
| 401 | Unauthorized (No token) |
| 403 | Forbidden (Wrong role) |
| 404 | Not Found |
| 409 | Conflict (Email exists) |
| 500 | Server Error |

---

## Database Seeding

Run seeding to populate test data:

```bash
npx prisma db seed
```

This creates:
- 1 Admin user
- 5 Test users (2 doctors, 3 patients)
- 4 System logs
- 3 Audit logs
- 3 Admin notifications
- 2 Detections

---

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Setup environment variables (.env):**
   ```
   DATABASE_URL=postgresql://...
   JWT_SECRET=your_secret_key
   PORT=3000
   ```

3. **Run migrations:**
   ```bash
   npx prisma migrate dev --name init
   ```

4. **Seed database:**
   ```bash
   npx prisma db seed
   ```

5. **Start server:**
   ```bash
   npm run dev
   ```

6. **Test endpoints:**
   - Login: `POST /api/auth/login`
   - Get Dashboard: `GET /api/v1/admin/dashboard/summary`

---

## API Summary Table

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/api/v1/admin/dashboard/summary` | Dashboard stats | Admin |
| GET | `/api/v1/admin/dashboard/user-growth` | User growth chart | Admin |
| GET | `/api/v1/admin/dashboard/role-distribution` | Role distribution | Admin |
| GET | `/api/v1/admin/system/logs` | System logs | Admin |
| POST | `/api/v1/admin/dashboard/report/generate` | Generate report | Admin |
| GET | `/api/v1/admin/dashboard/report/export` | Export report | Admin |
| GET | `/api/v1/admin/users` | List users | Admin |
| GET | `/api/v1/admin/users/:userId` | User detail | Admin |
| POST | `/api/v1/admin/users` | Create user | Admin |
| PATCH | `/api/v1/admin/users/:userId` | Update user | Admin |
| PATCH | `/api/v1/admin/users/:userId/status` | Change status | Admin |
| PATCH | `/api/v1/admin/users/:userId/role` | Change role | Admin |
| PATCH | `/api/v1/admin/users/:userId/reset-password` | Reset password | Admin |
| DELETE | `/api/v1/admin/users/:userId` | Delete user | Admin |
| GET | `/api/v1/admin/doctors/summary` | Doctor stats | Admin |
| GET | `/api/v1/admin/doctors` | List doctors | Admin |
| GET | `/api/v1/admin/doctors/:doctorId` | Doctor detail | Admin |
| GET | `/api/v1/admin/doctors/:doctorId/verification-requests` | Doctor cases | Admin |
| PATCH | `/api/v1/admin/doctors/:doctorId/approve` | Approve doctor | Admin |
| PATCH | `/api/v1/admin/doctors/:doctorId/reject` | Reject doctor | Admin |
| GET | `/api/v1/admin/profile` | Admin profile | Admin |
| PATCH | `/api/v1/admin/profile` | Update profile | Admin |
| PATCH | `/api/v1/admin/profile/photo` | Update photo | Admin |
| GET | `/api/v1/admin/verification-status` | Verification status | Admin |
| GET | `/api/v1/admin/settings` | All settings | Admin |
| PATCH | `/api/v1/admin/settings/account` | Account settings | Admin |
| PATCH | `/api/v1/admin/settings/2fa` | 2FA settings | Admin |
| PATCH | `/api/v1/admin/settings/notifications` | Notification settings | Admin |
| PATCH | `/api/v1/admin/settings/privacy` | Privacy settings | Admin |
| PATCH | `/api/v1/admin/settings/preferences` | Preferences | Admin |
| GET | `/api/v1/admin/notifications` | Get notifications | Admin |
| PATCH | `/api/v1/admin/notifications/:notificationId/read` | Mark read | Admin |
| PATCH | `/api/v1/admin/notifications/read-all` | Mark all read | Admin |
| GET | `/api/v1/admin/audit-logs` | Audit logs | Admin |
| POST | `/api/detection/cases/:detectionId/submit/:doctorId` | Submit case | Patient |
| GET | `/api/detection/my-cases` | Patient cases | Patient |
| GET | `/api/detection/doctor/:doctorId/cases` | Doctor cases | Doctor |
| GET | `/api/detection/cases/:caseId` | Case detail | Authenticated |
| POST | `/api/detection/cases/:caseId/review` | Case review | Doctor |

