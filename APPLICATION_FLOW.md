# 🎯 APPLICATION FLOW & PROCESS GUIDE

Dokumentasi lengkap alur proses jalannya aplikasi Melanoma Detection API.

---

## 📋 Table of Contents

1. [System Architecture Overview](#system-architecture-overview)
2. [Authentication Flow](#authentication-flow)
3. [Admin Management Flow](#admin-management-flow)
4. [Doctor Dashboard Flow](#doctor-dashboard-flow)
5. [Detection & Case Submission Flow](#detection--case-submission-flow)
6. [API Request/Response Flow](#api-requestresponse-flow)
7. [Database Operations Flow](#database-operations-flow)
8. [User Journey by Role](#user-journey-by-role)

---

## System Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT / FRONTEND                         │
│              (Web/Mobile - React/Vue/Angular)                   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓ HTTP/REST
┌─────────────────────────────────────────────────────────────────┐
│                      EXPRESS.JS SERVER                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │          MIDDLEWARE LAYER                                │   │
│  │  - CORS, JSON Parser, Auth Middleware                   │   │
│  │  - File Upload (Multer)                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │          ROUTES LAYER                                    │   │
│  │  - /api/auth          → Authentication                  │   │
│  │  - /api/v1/admin      → Admin Management                │   │
│  │  - /api/v1/doctor     → Doctor Dashboard                │   │
│  │  - /api/detection     → Case Management                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │          CONTROLLERS LAYER                               │   │
│  │  - Request validation                                    │   │
│  │  - Response formatting                                   │   │
│  │  - Error handling                                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │          SERVICES LAYER                                  │   │
│  │  - Business logic                                        │   │
│  │  - Data validation                                       │   │
│  │  - Audit logging                                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │          VALIDATORS LAYER                                │   │
│  │  - Input validation                                      │   │
│  │  - DTO patterns                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                     │
                     ↓ Prisma ORM
┌─────────────────────────────────────────────────────────────────┐
│                      PRISMA (ORM)                                │
│  - Query builder                                                │
│  - Migration manager                                            │
│  - Client generation                                            │
└─────────────────────────────────────────────────────────────────┘
                     │
                     ↓ SQL
┌─────────────────────────────────────────────────────────────────┐
│                    POSTGRESQL DATABASE                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Tables:                                                 │   │
│  │  - users, doctor_profiles, case_reviews                 │   │
│  │  - admin_settings, admin_notifications                  │   │
│  │  - audit_logs, system_logs                              │   │
│  │  - detections, case_assignments                         │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

                    ┌──────────────────┐
                    │  JWT SECRET      │
                    │  (Auth Token)    │
                    └──────────────────┘
```

### MVC Architecture Pattern

```
REQUEST
  ↓
ROUTES
  ├─ Path matching
  ├─ HTTP method check
  └─ Middleware execution (verifyToken, isAdmin, isDoctor)
  ↓
CONTROLLERS
  ├─ Receive request
  ├─ Extract parameters (body, query, params)
  ├─ Call validators
  └─ Call services
  ↓
VALIDATORS
  ├─ Validate input format
  ├─ Check required fields
  └─ Return errors if invalid
  ↓
SERVICES
  ├─ Business logic
  ├─ Database queries
  ├─ Data transformation
  └─ Audit logging
  ↓
PRISMA
  ├─ ORM operations
  └─ Database queries
  ↓
DATABASE
  ├─ CRUD operations
  └─ Return data
  ↓
RESPONSE
  ├─ Success response
  ├─ Error response
  └─ Status code
  ↓
CLIENT
```

---

## Authentication Flow

### 1. User Login Process

```
USER INPUT
  ├─ Email
  └─ Password
        ↓
   POST /api/auth/login
        ↓
   Controllers: auth.controller.js
        ├─ Extract email & password
        └─ Call authService.login()
        ↓
   Services: auth.service.js
        ├─ Find user by email
        ├─ Compare password with bcrypt
        ├─ Generate JWT token
        │   {
        │     id: user.id,
        │     role: user.role,
        │     exp: currentTime + 24h
        │   }
        └─ Return { token, role }
        ↓
   Response to CLIENT
        ├─ Status: 200
        └─ Body: { token: "eyJhbGc...", role: "admin|doctor|patient" }
        ↓
   CLIENT STORES TOKEN
        ├─ localStorage.setItem('token')
        └─ Ready for authorized requests
```

### 2. Token Verification for Protected Routes

```
CLIENT REQUEST
  ├─ Method: GET/POST/PATCH/DELETE
  ├─ URL: /api/v1/admin/...
  └─ Header: Authorization: Bearer <token>
        ↓
   MIDDLEWARE: auth.middleware.js → verifyToken
        ├─ Extract token from header
        ├─ Verify token with JWT_SECRET
        │   ├─ Valid?
        │   │  ├─ YES → Extract payload (id, role)
        │   │  │        ├─ req.user.id = payload.id
        │   │  │        ├─ req.user.role = payload.role
        │   │  │        └─ Continue to next middleware
        │   │  │
        │   │  └─ NO → Return 401 Unauthorized
        │   │         "Token tidak valid atau expired"
        ↓
   MIDDLEWARE: auth.middleware.js → isAdmin
        ├─ Check req.user.role === "admin"
        │   ├─ YES → Continue to controller
        │   └─ NO → Return 403 Forbidden
        │          "Hanya Admin yang bisa akses"
        ↓
   CONTROLLER EXECUTES
        ├─ Has user info: req.user
        ├─ Has database access
        └─ Can perform action
```

### 3. Token Flow Diagram

```
┌─────────────────┐
│  User Logs In   │
└────────┬────────┘
         │
         ↓
    Login Request
    (email, password)
         │
         ↓
  Validate Credentials
         │
      ┌──┴───┐
      │      │
    YES    NO
     │      │
     │   Return 401
     │      │
     ↓      └──→ Client
  Generate
   JWT Token
     │
     ↓
  Return { token }
     │
     ↓
Client Stores Token
(localStorage/sessionStorage)
     │
     ↓
Every Request:
Authorization: Bearer <token>
     │
     ↓
Server Verifies Token
     │
  ┌──┴────┐
  │       │
Valid  Invalid
  │       │
  ↓       ↓
Continue Error 401
```

---

## Admin Management Flow

### 1. Admin Dashboard Access Flow

```
ADMIN USER
  ├─ Logged in with role="admin"
  └─ Has valid JWT token
        ↓
GET /api/v1/admin/dashboard/summary
        │
        ├─ Middleware: verifyToken ✓
        ├─ Middleware: isAdmin ✓
        ├─ Middleware: Passed
        │
        ↓
Controllers: admin.controller.js
  └─ getDashboardSummary()
        │
        ├─ Validation: ✓ (no params needed)
        └─ Call adminService.getDashboardSummary()
        │
        ↓
Services: admin.service.js
  └─ getDashboardSummary()
        │
        ├─ Query: COUNT(users)
        ├─ Query: COUNT(active sessions)
        ├─ Query: Calculate storage usage
        ├─ Query: Get average detection accuracy
        │
        ↓
Database Queries
  ├─ SELECT COUNT(*) FROM users
  ├─ SELECT * FROM session_logs WHERE active=true
  └─ Calculate metrics
        │
        ↓
Response Data
  {
    totalUsers: 14285,
    activeSessions: 842,
    storageUsage: { percentage: 78, used: "4.2 TB" },
    averageDetectionAccuracy: 96.4
  }
        │
        ↓
Controller Response
  {
    status: "success",
    data: { ... },
    message: "Dashboard summary retrieved"
  }
        │
        ↓
CLIENT DISPLAYS
  ├─ Total Users Widget
  ├─ Active Sessions Widget
  ├─ Storage Usage Bar
  └─ Accuracy Metric
```

### 2. Admin User Management Flow

#### Create New User

```
ADMIN FORM
  ├─ fullName: "Dr. Helena"
  ├─ email: "helena@mail.com"
  ├─ password: "password123"
  ├─ role: "doctor"
  ├─ gender: "female"
  ├─ phoneNumber: "+628134567890"
  └─ birthDate: "1990-04-23"
        ↓
POST /api/v1/admin/users
        │
        ├─ Middleware: verifyToken ✓
        ├─ Middleware: isAdmin ✓
        │
        ↓
Controllers: admin.controller.js
  └─ createUser()
        │
        ├─ Validate request body using validators
        │   ├─ Check fullName not empty
        │   ├─ Check email format (regex)
        │   ├─ Check password length >= 6
        │   ├─ Check role in ["admin", "doctor", "patient"]
        │   └─ Return errors if invalid
        │
        ├─ Call adminService.createUser(data)
        │
        ↓
Services: admin.service.js
  └─ createUser(userData)
        │
        ├─ Check email uniqueness
        │   ├─ SELECT * FROM users WHERE email = ?
        │   ├─ Email exists?
        │   │  ├─ YES → Throw error 409 Conflict
        │   │  └─ NO → Continue
        │   │
        ├─ Hash password with bcrypt
        │   ├─ bcrypt.hash(password, saltRounds=10)
        │   └─ hashedPassword
        │   │
        ├─ Create user in database
        │   ├─ INSERT INTO users (email, password, role, ...)
        │   └─ Return user record
        │   │
        ├─ Create audit log
        │   ├─ adminId: req.user.id
        │   ├─ action: "CREATE_USER"
        │   ├─ description: "Created doctor Dr. Helena"
        │   ├─ timestamp: now()
        │   └─ INSERT INTO audit_logs
        │
        ↓
Database Operations
  ├─ INSERT users
  ├─ INSERT audit_logs
  └─ Commit transaction
        │
        ↓
Response to Controller
  {
    userId: "uuid-456",
    fullName: "Dr. Helena",
    email: "helena@mail.com",
    role: "doctor",
    status: "pending"
  }
        │
        ↓
Return to Client
  Status: 201 Created
  {
    status: "success",
    message: "User created successfully",
    data: { userId, fullName, role, email }
  }
        │
        ↓
CLIENT UPDATES
  ├─ Refresh user list
  ├─ Show success notification
  └─ Clear form
```

#### Edit User

```
ADMIN CLICKS "Edit User"
  ├─ Selects user from list
  ├─ Form pre-fills with current data
  ├─ Makes changes (e.g., phone number)
  └─ Clicks "Save"
        ↓
PATCH /api/v1/admin/users/:userId
        │
        ├─ Middleware: verifyToken ✓
        ├─ Middleware: isAdmin ✓
        │
        ↓
Controllers: admin.controller.js
  └─ updateUser(req, res)
        │
        ├─ Extract userId from params
        ├─ Extract updated fields from body
        ├─ Validate fields
        │
        ↓
Services: admin.service.js
  └─ updateUser(userId, updateData)
        │
        ├─ Find user by ID
        │   ├─ SELECT * FROM users WHERE id = ?
        │   ├─ User exists?
        │   │  ├─ NO → Throw 404 Not Found
        │   │  └─ YES → Continue
        │   │
        ├─ Update user fields
        │   ├─ UPDATE users SET field=value WHERE id=?
        │   └─ Return updated user
        │   │
        ├─ Create audit log
        │   ├─ action: "UPDATE_USER"
        │   ├─ description: "Updated phone number for Dr. Helena"
        │   └─ INSERT INTO audit_logs
        │
        ↓
Response
  Status: 200 OK
  {
    status: "success",
    message: "User updated successfully"
  }
        │
        ↓
CLIENT UPDATES
  ├─ Close edit form
  ├─ Refresh user list
  └─ Show success notification
```

#### Delete User (Soft Delete)

```
ADMIN CLICKS "Delete User"
        │
        ├─ Confirmation dialog appears
        └─ Clicks "Confirm Delete"
        ↓
DELETE /api/v1/admin/users/:userId
        │
        ├─ Middleware: verifyToken ✓
        ├─ Middleware: isAdmin ✓
        │
        ↓
Services: admin.service.js
  └─ deleteUser(userId)
        │
        ├─ Find user
        ├─ Set status = "inactive" (SOFT DELETE)
        │   ├─ UPDATE users SET status='inactive' WHERE id=?
        │   └─ Data NOT deleted, just marked inactive
        │   │
        ├─ Create audit log
        │   ├─ action: "DELETE_USER"
        │   ├─ description: "Deleted user Dr. Helena"
        │   └─ INSERT INTO audit_logs
        │
        ↓
Response
  Status: 200 OK
  {
    status: "success",
    message: "User deleted successfully"
  }
        │
        ↓
CLIENT
  ├─ Removes user from list
  └─ Shows notification
```

### 3. Doctor Approval Workflow

```
DOCTOR APPLIES
  ├─ Register as doctor
  ├─ Upload documents
  └─ Submit for approval
        ↓
CREATED IN DATABASE
  └─ status: "pending"
        ↓
ADMIN SEES NOTIFICATION
  ├─ Gets notification in admin panel
  ├─ Clicks "View Doctor Requests"
  └─ Sees pending doctors
        ↓
ADMIN REVIEWS
  ├─ Checks doctor credentials
  ├─ Verifies documents
  └─ Makes decision
        ↓
APPROVE:
PATCH /api/v1/admin/doctors/:doctorId/approve
  {
    "note": "License verified and approved"
  }
        │
        ├─ Middleware: verifyToken ✓
        ├─ Middleware: isAdmin ✓
        │
        ↓
Services:
  ├─ Update doctor status = "verified"
  ├─ Send notification to doctor
  ├─ Create audit log
  │  ├─ action: "APPROVE_DOCTOR"
  │  ├─ description: "Approved doctor Dr. Elena"
  │  └─ INSERT INTO audit_logs
        │
        ↓
DOCTOR NOTIFICATION:
  ├─ Type: "doctor_approval"
  ├─ Status: "approved"
  ├─ Message: "Your doctor application has been approved!"
  └─ isRead: false
        │
        ↓
REJECT:
PATCH /api/v1/admin/doctors/:doctorId/reject
  {
    "reason": "License document is invalid"
  }
        │
        ├─ Update doctor status = "rejected"
        ├─ Create notification with reason
        ├─ Create audit log (REJECT_DOCTOR)
        │
        ↓
DOCTOR NOTIFICATION:
  ├─ Type: "doctor_approval"
  ├─ Status: "rejected"
  ├─ Message: "Your application was rejected: License document is invalid"
  └─ isRead: false
        │
        ↓
CLIENT UPDATES
  ├─ Refresh pending list
  └─ Move to approved/rejected list
```

---

## Doctor Dashboard Flow

### 1. Doctor Login & Dashboard Access

```
DOCTOR USER
  ├─ Email: doctor@mail.com
  ├─ Password: password123
  └─ Role: "doctor"
        ↓
Login Process (same as auth flow)
        ├─ POST /api/auth/login
        ├─ Verify credentials
        ├─ Generate JWT token
        └─ Return { token, role: "doctor" }
        ↓
Doctor accesses dashboard
        │
        ├─ Middleware: verifyToken ✓
        ├─ Middleware: isDoctor ✓ (req.user.role === "doctor")
        │
        ↓
GET /api/v1/doctor/dashboard/summary
        │
        ↓
Services:
  ├─ Get assigned cases count
  ├─ Get pending cases count
  ├─ Get average review time
  ├─ Get doctor statistics
        │
        ↓
Response:
  {
    totalAssigned: 45,
    pendingReview: 8,
    averageReviewTime: "2.5 hours",
    totalApproved: 38,
    totalRejected: 1
  }
        │
        ↓
CLIENT DISPLAYS
  ├─ Dashboard widgets
  ├─ Case counters
  ├─ Pending cases table
  └─ Recent activity
```

### 2. Doctor Case Review Flow

```
DOCTOR VIEWS ASSIGNED CASES
        │
        ├─ GET /api/v1/doctor/cases/assigned
        │
        ├─ Middleware: verifyToken ✓
        ├─ Middleware: isDoctor ✓
        │
        ↓
Services: doctor.service.js
  └─ getAssignedCases(doctorId, page, limit)
        │
        ├─ Query pending cases
        │   ├─ SELECT * FROM case_reviews
        │   ├─ WHERE doctorId = ? AND status = "pending_review"
        │   ├─ LIMIT & OFFSET for pagination
        │   │
        ├─ Include patient info
        ├─ Include AI diagnosis
        └─ Include submission date
        │
        ↓
Response (with pagination):
  {
    data: [
      {
        caseId: "CASE-001",
        patientName: "Sarah Johnson",
        patientAge: 42,
        imageUrl: "/uploads/detections/sample.jpg",
        aiDiagnosis: "87% Melanoma",
        submittedAt: "2026-04-22T10:30:00Z",
        status: "pending_review"
      }
    ],
    meta: {
      page: 1,
      limit: 10,
      total: 25,
      totalPages: 3
    }
  }
        │
        ↓
CLIENT DISPLAYS
  ├─ Case list table
  ├─ Pagination controls
  └─ Click to view detail
```

### 3. Review Case Detail & Submit Observation

```
DOCTOR CLICKS CASE
        │
        ↓
GET /api/v1/doctor/cases/:caseId
        │
        ├─ Middleware: verifyToken ✓
        ├─ Middleware: isDoctor ✓
        │
        ↓
Services:
  ├─ Get case review details
  ├─ Get AI predictions
  ├─ Get patient history
  ├─ Get previous observations
        │
        ↓
Response:
  {
    caseId: "CASE-001",
    patientName: "Sarah Johnson",
    patientAge: 42,
    patientGender: "female",
    imageUrl: "/uploads/detections/sample.jpg",
    aiDiagnosis: "87% Melanoma",
    
    patientNotes: "Brown spot on my arm",
    
    aiDetails: {
      predictionLabel: "Melanoma",
      confidence: 87,
      alternativePredictions: [
        { label: "Benign Nevus", score: 10 },
        { label: "Other", score: 3 }
      ]
    },
    
    status: "pending_review",
    submittedAt: "2026-04-22T10:30:00Z",
    observations: []
  }
        │
        ↓
DOCTOR REVIEWS IMAGE
  ├─ Uses image viewer (zoom, pan)
  ├─ Reads patient history
  ├─ Reads AI predictions
  └─ Forms opinion
        │
        ↓
DOCTOR ADDS OBSERVATION
POST /api/v1/doctor/cases/:caseId/observation
  {
    "observation": "Asymmetrical shape and irregular borders"
  }
        │
        ├─ Middleware: verifyToken ✓
        ├─ Middleware: isDoctor ✓
        │
        ↓
Services:
  ├─ Save observation
  │   ├─ INSERT INTO doctor_observations
  │   ├─ doctorId, caseId, observation
  │   └─ timestamp
  │
        ↓
Response:
  {
    status: "success",
    message: "Observation saved",
    data: {
      observationId: "OBS-001",
      observation: "Asymmetrical shape and irregular borders",
      createdAt: "2026-04-22T11:00:00Z"
    }
  }
        │
        ↓
DOCTOR SUBMITS REVIEW
PATCH /api/v1/doctor/cases/:caseId/approve OR /reject
  {
    "physicianObservation": "Consistent with malignant melanoma",
    "finalDiagnosis": "Malignant Melanoma"
  }
        │
        ├─ Middleware: verifyToken ✓
        ├─ Middleware: isDoctor ✓
        │
        ↓
Services:
  ├─ Update case review
  │   ├─ SET status = "approved"
  │   ├─ SET finalDiagnosis = "Malignant Melanoma"
  │   ├─ SET reviewedAt = now()
  │   └─ UPDATE case_reviews
  │
  ├─ Create notification for patient
  │   ├─ patientId, type, message
  │   └─ INSERT INTO notifications
  │
  ├─ Update case statistics
  │
        ↓
Response:
  Status: 200 OK
  {
    status: "success",
    message: "Case review submitted successfully",
    data: {
      caseId: "CASE-001",
      status: "approved",
      reviewedAt: "2026-04-22T11:30:00Z"
    }
  }
        │
        ↓
CLIENT:
  ├─ Close case detail
  ├─ Refresh case list
  ├─ Remove from pending
  ├─ Add to reviewed
  └─ Show success message
        │
        ↓
PATIENT GETS NOTIFICATION
  ├─ Type: "case_reviewed"
  ├─ Message: "Your case has been reviewed"
  ├─ Shows: Doctor's diagnosis
  └─ isRead: false
```

---

## Detection & Case Submission Flow

### 1. Patient Detection Prediction

```
PATIENT UPLOADS LESION IMAGE
  ├─ Selects image file
  ├─ Uploads to server
  └─ Clicks "Analyze"
        ↓
POST /api/detection/predict
  (existing endpoint - not part of admin/doctor)
        │
        ├─ Validate image
        ├─ Send to AI model
        ├─ Get prediction
        └─ Save to database
        │
        ↓
DETECTION CREATED
  ├─ detectionId: "DET-001"
  ├─ patientId: user.id
  ├─ imageUrl: "/uploads/detections/..."
  ├─ aiPrediction: "87% Melanoma"
  ├─ confidence: 87
  ├─ createdAt: now()
        │
        ↓
RESPONSE TO PATIENT
  {
    status: "success",
    data: {
      detectionId: "DET-001",
      prediction: "87% Melanoma",
      confidence: 87,
      message: "Analysis complete. You can submit to doctor."
    }
  }
        │
        ↓
CLIENT SHOWS
  ├─ AI Analysis Results
  ├─ Confidence Score
  ├─ Warning if high risk
  └─ Button: "Submit to Doctor for Review"
```

### 2. Patient Submits Case to Doctor

```
PATIENT CLICKS "Submit to Doctor"
  ├─ Selects doctor from list
  ├─ (optional) Adds notes
  └─ Clicks "Submit"
        ↓
POST /api/detection/cases/:detectionId/submit/:doctorId
  {
    "notes": "Patient reports itching and color changes"
  }
        │
        ├─ patientId: req.user.id (from JWT)
        ├─ detectionId: from URL
        ├─ doctorId: from URL
        │
        ├─ Middleware: verifyToken ✓
        ├─ Middleware: Patient role check
        │
        ↓
Controllers: detection.controller.js
  └─ submitCaseToDoctor(req, res)
        │
        ├─ Extract parameters
        ├─ Validate detectionId exists
        ├─ Validate doctorId exists
        ├─ Validate patient owns detection
        │
        ↓
Services: detection.service.js
  └─ submitCaseToDoctor(detectionId, patientId, doctorId, notes)
        │
        ├─ Get detection record
        │   ├─ SELECT * FROM detections WHERE id = ?
        │   ├─ Check if patientId matches
        │   │  └─ If not, throw 403 Forbidden
        │   │
        ├─ Create case review (CaseReview table)
        │   ├─ INSERT INTO case_reviews (
        │   │     detectionId,
        │   │     patientId,
        │   │     patientName,
        │   │     patientAge,
        │   │     clinicalImageUrl,
        │   │     aiPredictionLabel,
        │   │     aiConfidencePercentage,
        │   │     patientNotes,
        │   │     doctorId,
        │   │     status: "pending_review",
        │   │     receivedAt: now()
        │   │   )
        │   └─ Get generated caseId
        │   │
        ├─ Create case assignment (CaseAssignment table)
        │   ├─ INSERT INTO case_assignments (
        │   │     doctorId,
        │   │     caseId,
        │   │     assignedAt: now()
        │   │   )
        │   │
        ├─ Create notification for doctor
        │   ├─ INSERT INTO notifications (
        │   │     doctorId,
        │   │     type: "case_request",
        │   │     title: "New Case Assignment",
        │   │     message: "Sarah Johnson submitted a case for review",
        │   │     isRead: false
        │   │   )
        │   │
        ├─ Audit log (optional)
        │
        ↓
Response to Controller
  {
    caseId: "CASE-1650616200000",
    doctorId: "SKN-2041",
    doctorName: "Dr. Elena Aris",
    status: "pending_review",
    submittedAt: "2026-04-22T10:30:00Z"
  }
        │
        ↓
Return to Patient
  Status: 201 Created
  {
    status: "success",
    message: "Case submitted to doctor successfully",
    data: { caseId, doctorName, status }
  }
        │
        ↓
CLIENT:
  ├─ Show success message
  ├─ Save caseId
  ├─ Redirect to patient cases
        │
        ↓
DATABASE STATE
  ├─ detections.status: possibly updated
  ├─ case_reviews: NEW RECORD
  ├─ case_assignments: NEW RECORD
  ├─ notifications: NEW for doctor
        │
        ↓
DOCTOR RECEIVES NOTIFICATION
  ├─ Real-time notification (if WebSocket)
  ├─ Or: Sees in notifications panel
  ├─ Can click to view case
  └─ Can start review
```

### 3. Patient Checks Case Status

```
PATIENT CLICKS "My Cases"
        │
        ↓
GET /api/detection/my-cases?page=1&limit=10
        │
        ├─ patientId: req.user.id (from JWT)
        ├─ Middleware: verifyToken ✓
        │
        ↓
Services:
  └─ getPatientCases(patientId, page, limit)
        │
        ├─ Query cases for this patient
        │   ├─ SELECT * FROM case_reviews
        │   ├─ WHERE patientId = ?
        │   ├─ ORDER BY receivedAt DESC
        │   ├─ LIMIT & OFFSET
        │   │
        ├─ Include doctor info
        ├─ Include status
        ├─ Include submission & review dates
        │
        ↓
Response:
  {
    data: [
      {
        caseId: "CASE-001",
        patientName: "Sarah Johnson",
        imageUrl: "/uploads/detections/sample.jpg",
        aiDiagnosis: "87% Melanoma",
        status: "pending_review",
        assignedDoctor: {
          doctorId: "SKN-2041",
          name: "Dr. Elena Aris",
          email: "elenaaris@icloud.com",
          avatarUrl: "/uploads/doctors/elena.png"
        },
        submittedAt: "2026-04-22T10:30:00Z",
        reviewedAt: null
      },
      {
        caseId: "CASE-002",
        patientName: "Sarah Johnson",
        imageUrl: "/uploads/detections/sample2.jpg",
        aiDiagnosis: "45% Benign",
        status: "approved",
        assignedDoctor: { ... },
        submittedAt: "2026-04-20T08:00:00Z",
        reviewedAt: "2026-04-20T14:30:00Z",
        finalDiagnosis: "Benign Nevus"
      }
    ],
    meta: {
      page: 1,
      limit: 10,
      total: 5,
      totalPages: 1
    }
  }
        │
        ↓
CLIENT DISPLAYS
  ├─ Case list table
  ├─ Status badges (pending/approved/rejected)
  ├─ Doctor names
  ├─ Dates
  └─ Final diagnosis if reviewed
        │
        ↓
PATIENT CLICKS CASE DETAIL
        │
        ↓
GET /api/detection/cases/:caseId
        │
        ├─ Middleware: verifyToken ✓
        │
        ↓
Services:
  ├─ Get case details
  ├─ Get doctor observations
  ├─ Get final diagnosis
        │
        ↓
Response:
  {
    caseId: "CASE-001",
    patientName: "Sarah Johnson",
    imageUrl: "/uploads/detections/sample.jpg",
    aiDiagnosis: "87% Melanoma",
    status: "pending_review",
    doctor: {
      name: "Dr. Elena Aris",
      email: "elenaaris@icloud.com"
    },
    observations: [],
    reviewedAt: null
  }
  OR (if reviewed):
  {
    caseId: "CASE-002",
    status: "approved",
    finalDiagnosis: "Malignant Melanoma",
    doctorObservation: "Consistent with clinical findings",
    observations: [
      {
        observationId: "OBS-001",
        doctorName: "Dr. Elena Aris",
        observation: "Asymmetrical shape and irregular borders",
        createdAt: "2026-04-22T11:00:00Z"
      }
    ],
    reviewedAt: "2026-04-22T11:30:00Z"
  }
        │
        ↓
CLIENT DISPLAYS
  ├─ If pending: "Waiting for doctor review"
  ├─ If reviewed:
  │   ├─ Final diagnosis
  │   ├─ Doctor observations
  │   ├─ Review date
  │   └─ Recommendation
```

---

## API Request/Response Flow

### Standard Request Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ CLIENT REQUEST                                                  │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ Method: GET/POST/PATCH/DELETE                            │  │
│ │ URL: http://localhost:3000/api/v1/admin/users            │  │
│ │ Headers: {                                                │  │
│ │   "Authorization": "Bearer eyJhbGc...",                   │  │
│ │   "Content-Type": "application/json"                      │  │
│ │ }                                                         │  │
│ │ Body: {                                                   │  │
│ │   "fullName": "Dr. Helena",                              │  │
│ │   "email": "helena@mail.com",                            │  │
│ │   "role": "doctor"                                        │  │
│ │ }                                                         │  │
│ └───────────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ↓ HTTP
┌─────────────────────────────────────────────────────────────────┐
│ EXPRESS SERVER                                                  │
│                                                                 │
│ 1. CORS MIDDLEWARE                                             │
│    ├─ Check origin                                            │
│    ├─ Add CORS headers                                        │
│    └─ Continue if OK                                          │
│                                                                 │
│ 2. BODY PARSER MIDDLEWARE                                      │
│    ├─ Parse JSON body                                         │
│    ├─ Validate JSON format                                    │
│    └─ Set req.body                                            │
│                                                                 │
│ 3. ROUTE MATCHING                                              │
│    ├─ Match URL pattern                                       │
│    ├─ Match HTTP method                                       │
│    └─ Set req.params, req.query                              │
│                                                                 │
│ 4. MIDDLEWARE CHAIN                                            │
│    ├─ verifyToken                                             │
│    │  ├─ Extract token from header                           │
│    │  ├─ Verify with JWT_SECRET                              │
│    │  ├─ Set req.user = decoded payload                      │
│    │  └─ Continue or return 401                              │
│    │                                                           │
│    ├─ isAdmin                                                  │
│    │  ├─ Check req.user.role === "admin"                     │
│    │  └─ Continue or return 403                              │
│    │                                                           │
│    └─ upload.single('photo') [if applicable]                 │
│       ├─ Handle multipart/form-data                          │
│       ├─ Save file to /uploads                               │
│       └─ Set req.file                                         │
│                                                                 │
│ 5. CONTROLLER EXECUTION                                        │
│    ├─ Extract request data                                   │
│    ├─ Call validators                                        │
│    │  ├─ Validate fullName not empty                         │
│    │  ├─ Validate email format                               │
│    │  ├─ Validate role enum                                  │
│    │  └─ Return errors array if invalid                      │
│    │                                                           │
│    ├─ If validation fails:                                   │
│    │  └─ res.status(400).json({ errors })                    │
│    │                                                           │
│    ├─ Call service layer                                     │
│    ├─ Handle errors from service                             │
│    └─ Format success response                                │
│                                                                 │
│ 6. SERVICE LAYER                                               │
│    ├─ Execute business logic                                 │
│    ├─ Database queries via Prisma                            │
│    ├─ Error handling                                         │
│    ├─ Audit logging                                          │
│    └─ Return result or throw error                           │
│                                                                 │
│ 7. ERROR HANDLING                                              │
│    ├─ Global error handler catches all errors                │
│    ├─ Format error response                                  │
│    └─ Return appropriate status code                         │
│                                                                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ↓ HTTP Response
┌─────────────────────────────────────────────────────────────────┐
│ RESPONSE                                                        │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ Status: 201 Created                                       │  │
│ │ Headers: {                                                │  │
│ │   "Content-Type": "application/json",                     │  │
│ │   "Access-Control-Allow-Origin": "*"                     │  │
│ │ }                                                         │  │
│ │ Body: {                                                   │  │
│ │   "status": "success",                                    │  │
│ │   "message": "User created successfully",                │  │
│ │   "data": {                                               │  │
│ │     "userId": "uuid-456",                                 │  │
│ │     "fullName": "Dr. Helena",                             │  │
│ │     "email": "helena@mail.com",                           │  │
│ │     "role": "doctor",                                     │  │
│ │     "status": "pending"                                   │  │
│ │   }                                                       │  │
│ │ }                                                         │  │
│ └───────────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ↓ JavaScript
┌─────────────────────────────────────────────────────────────────┐
│ CLIENT PROCESSING                                               │
│ ├─ Parse JSON response                                         │
│ ├─ Check status === "success"                                  │
│ ├─ If success:                                                 │
│ │  ├─ Update UI                                               │
│ │  ├─ Show notification                                       │
│ │  └─ Refresh list or navigate                                │
│ │                                                               │
│ ├─ If error:                                                   │
│ │  ├─ Show error message                                      │
│ │  ├─ Highlight invalid fields                                │
│ │  └─ Allow user to retry                                     │
│ │                                                               │
│ └─ Close loading spinner                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Error Response Flow

```
REQUEST WITH INVALID DATA
  └─ Email format invalid
        │
        ↓
CONTROLLER
  ├─ Call validators
  │  └─ validateCreateUser(data)
  │      ├─ email regex check fails
  │      └─ return { email: "Invalid email format" }
  │
  ├─ Validation errors found
  ├─ return res.status(400).json({
  │    status: "error",
  │    message: "Validation failed",
  │    errors: { email: "Invalid email format" }
  │  })
        │
        ↓
CLIENT RECEIVES
  Status: 400 Bad Request
  {
    status: "error",
    message: "Validation failed",
    errors: {
      email: "Invalid email format"
    }
  }
        │
        ↓
CLIENT DISPLAYS
  ├─ Show error message
  ├─ Highlight email field in red
  └─ Allow retry
```

---

## Database Operations Flow

### Create Operation (INSERT)

```
SERVICE RECEIVES DATA
  {
    fullName: "Dr. Helena",
    email: "helena@mail.com",
    password: "password123",
    role: "doctor"
  }
        │
        ↓
VALIDATE BUSINESS RULES
  ├─ Check email uniqueness
  │  ├─ SELECT COUNT(*) FROM users WHERE email = ?
  │  ├─ Count > 0?
  │  │  ├─ YES → Throw error 409 Conflict
  │  │  └─ NO → Continue
  │
  ├─ Check role is valid
  ├─ Check password length
  └─ All validations pass
        │
        ↓
TRANSFORM DATA
  ├─ Hash password
  │  └─ bcrypt.hash(password, 10)
  │
  ├─ Generate user ID (UUID)
  ├─ Set createdAt = now()
  ├─ Set status = "pending" (default)
        │
        ↓
DATABASE INSERT
  ├─ INSERT INTO users (
  │    id,
  │    fullName,
  │    email,
  │    password,
  │    role,
  │    status,
  │    createdAt,
  │    updatedAt
  │  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  │
  ├─ Prisma client executes:
  │  └─ await prisma.user.create({ data: {...} })
  │
  └─ Transaction committed
        │
        ↓
CREATE AUDIT LOG
  ├─ INSERT INTO audit_logs (
  │    auditId: "AUD-" + timestamp,
  │    adminId: req.user.id,
  │    adminName: "Admin Name",
  │    action: "CREATE_USER",
  │    description: "Created doctor Dr. Helena",
  │    targetResourceType: "user",
  │    targetResourceId: newUser.id,
  │    ipAddress: req.ip,
  │    status: "success",
  │    createdAt: now()
  │  )
        │
        ↓
RETURN RESULT
  {
    userId: "uuid-456",
    fullName: "Dr. Helena",
    email: "helena@mail.com",
    role: "doctor",
    status: "pending"
  }
```

### Read Operation (SELECT)

```
REQUEST FOR DATA
  ├─ GET /api/v1/admin/users?role=doctor&page=1&limit=8
  ├─ Extract query params
  │  ├─ role: "doctor"
  │  ├─ page: 1
  │  └─ limit: 8
        │
        ↓
SERVICE QUERY
  ├─ Build WHERE clause
  │  └─ role = "doctor" AND status != "inactive"
  │
  ├─ Count total matching records
  │  ├─ SELECT COUNT(*) FROM users WHERE role='doctor'
  │  └─ total = 150
  │
  ├─ Calculate pagination
  │  ├─ offset = (page - 1) * limit = 0
  │  ├─ totalPages = ceil(total / limit) = ceil(150 / 8) = 19
  │
  ├─ Execute paginated query
  │  ├─ SELECT id, fullName, email, role, status, createdAt
  │  ├─ FROM users
  │  ├─ WHERE role='doctor'
  │  ├─ ORDER BY createdAt DESC
  │  ├─ LIMIT 8 OFFSET 0
  │
  └─ Return records
        │
        ↓
FORMAT RESPONSE
  {
    data: [
      { userId: "...", fullName: "...", ... },
      { userId: "...", fullName: "...", ... }
    ],
    meta: {
      page: 1,
      limit: 8,
      total: 150,
      totalPages: 19
    }
  }
```

### Update Operation (UPDATE)

```
REQUEST TO UPDATE
  ├─ PATCH /api/v1/admin/users/uuid-456
  ├─ Body: { phoneNumber: "+628134567890" }
        │
        ↓
SERVICE VALIDATION
  ├─ Check user exists
  │  ├─ SELECT * FROM users WHERE id = ?
  │  ├─ User found?
  │  │  ├─ NO → Throw 404 Not Found
  │  │  └─ YES → Continue
  │
  ├─ Validate update data
  └─ Allow update
        │
        ↓
DATABASE UPDATE
  ├─ UPDATE users
  ├─ SET phoneNumber = '+628134567890', updatedAt = now()
  ├─ WHERE id = 'uuid-456'
  │
  ├─ Prisma:
  │  └─ await prisma.user.update({
  │       where: { id: 'uuid-456' },
  │       data: { phoneNumber: '+628134567890' }
  │     })
  │
  └─ Return updated record
        │
        ↓
CREATE AUDIT LOG
  ├─ INSERT INTO audit_logs (
  │    action: "UPDATE_USER",
  │    description: "Updated phone number for Dr. Helena",
  │    targetResourceId: uuid-456,
  │    ...
  │  )
        │
        ↓
RESPONSE
  {
    status: "success",
    message: "User updated successfully"
  }
```

### Delete Operation (SOFT DELETE)

```
REQUEST TO DELETE
  ├─ DELETE /api/v1/admin/users/uuid-456
        │
        ↓
SERVICE
  ├─ Check user exists
  ├─ Update status to "inactive" (NOT DELETE)
  │
  ├─ UPDATE users
  ├─ SET status = 'inactive', updatedAt = now()
  ├─ WHERE id = 'uuid-456'
        │
        ↓
DATABASE
  ├─ Record NOT deleted from database
  ├─ status field changed to "inactive"
  ├─ Can be recovered if needed
        │
        ↓
CREATE AUDIT LOG
  ├─ action: "DELETE_USER"
  ├─ Store deletion reason
        │
        ↓
RESPONSE
  {
    status: "success",
    message: "User deleted successfully"
  }
```

---

## User Journey by Role

### 👨‍💼 Admin User Journey

```
1. ADMIN OPENS APPLICATION
   ├─ Visits http://app.com/admin
   ├─ Sees login form
   └─ Enters email & password

2. LOGIN
   ├─ Submits credentials
   ├─ POST /api/auth/login
   ├─ Receives JWT token
   └─ Token saved to localStorage

3. ADMIN DASHBOARD
   ├─ GET /api/v1/admin/dashboard/summary
   ├─ Views:
   │  ├─ Total users count
   │  ├─ Active sessions
   │  ├─ Storage usage
   │  └─ Detection accuracy
   └─ Sees recent activities

4. USER MANAGEMENT
   ├─ Clicks "User Management"
   ├─ GET /api/v1/admin/users?role=all
   ├─ Views user list
   ├─ Options:
   │  ├─ Create new user
   │  │  ├─ Form: fullName, email, password, role
   │  │  ├─ POST /api/v1/admin/users
   │  │  └─ New user created
   │  │
   │  ├─ Edit user
   │  │  ├─ Click user row
   │  │  ├─ Update fields
   │  │  ├─ PATCH /api/v1/admin/users/:userId
   │  │  └─ Changes saved
   │  │
   │  ├─ Change user status
   │  │  ├─ PATCH /api/v1/admin/users/:userId/status
   │  │  └─ Status updated
   │  │
   │  ├─ Change user role
   │  │  ├─ PATCH /api/v1/admin/users/:userId/role
   │  │  └─ Role changed
   │  │
   │  ├─ Reset password
   │  │  ├─ PATCH /api/v1/admin/users/:userId/reset-password
   │  │  └─ Password reset
   │  │
   │  └─ Delete user
   │     ├─ Confirm deletion
   │     ├─ DELETE /api/v1/admin/users/:userId
   │     └─ User marked inactive

5. DOCTOR MANAGEMENT
   ├─ Clicks "Doctor Management"
   ├─ GET /api/v1/admin/doctors
   ├─ Sees doctor list
   ├─ Checks pending approvals
   ├─ Approves/rejects doctor applications
   │  ├─ PATCH /api/v1/admin/doctors/:id/approve
   │  └─ PATCH /api/v1/admin/doctors/:id/reject
   └─ Tracks doctor statistics

6. SETTINGS
   ├─ Clicks "Settings"
   ├─ Views:
   │  ├─ Account settings (email, password)
   │  ├─ 2FA settings
   │  ├─ Notification preferences
   │  └─ Privacy settings
   ├─ Updates settings
   └─ Changes saved

7. NOTIFICATIONS
   ├─ Views notification bell
   ├─ Gets alerts for:
   │  ├─ New doctor applications
   │  ├─ System issues
   │  ├─ User activities
   │  └─ Case submissions
   ├─ Clicks notification
   ├─ Marks as read
   └─ Takes action

8. AUDIT LOGS
   ├─ Views audit log
   ├─ Sees all admin actions
   │  ├─ CREATE_USER
   │  ├─ UPDATE_USER
   │  ├─ APPROVE_DOCTOR
   │  └─ etc.
   ├─ Filters by date, admin, action
   └─ Exports for compliance

9. LOGOUT
   ├─ Clicks logout
   ├─ Token removed from localStorage
   ├─ Redirected to login
   └─ Session ended
```

### 👨‍⚕️ Doctor User Journey

```
1. DOCTOR OPENS APPLICATION
   ├─ Visits http://app.com/doctor
   ├─ Sees login form
   └─ Enters email & password

2. LOGIN
   ├─ Submits credentials
   ├─ POST /api/auth/login
   ├─ Receives JWT token
   └─ Token saved to localStorage

3. DOCTOR DASHBOARD
   ├─ GET /api/v1/doctor/dashboard/summary
   ├─ Views:
   │  ├─ Total assigned cases
   │  ├─ Pending reviews
   │  ├─ Average review time
   │  └─ Approval statistics
   └─ Sees recent assignments

4. VIEW ASSIGNED CASES
   ├─ Clicks "My Cases"
   ├─ GET /api/v1/doctor/cases/assigned
   ├─ Views pending cases list
   ├─ Filters by status, date, patient
   └─ Pagination support

5. REVIEW CASE DETAIL
   ├─ Clicks case from list
   ├─ GET /api/v1/doctor/cases/:caseId
   ├─ Views:
   │  ├─ Lesion image (with zoom)
   │  ├─ Patient info
   │  ├─ AI diagnosis & confidence
   │  ├─ Patient notes
   │  └─ Previous observations
   └─ Analyzes case

6. ADD OBSERVATION
   ├─ Types observation notes
   ├─ POST /api/v1/doctor/cases/:caseId/observation
   ├─ Observation saved
   └─ Shows timestamp

7. SUBMIT REVIEW
   ├─ Selects decision: Approve/Reject
   ├─ Enters final diagnosis
   ├─ PATCH /api/v1/doctor/cases/:caseId/approve
   ├─ Or PATCH /api/v1/doctor/cases/:caseId/reject
   └─ Review submitted

8. VIEW CASE HISTORY
   ├─ GET /api/v1/doctor/cases/history
   ├─ Filters by date range, status
   ├─ Sees past cases
   ├─ Views statistics
   └─ Exports report

9. PROFILE SETTINGS
   ├─ Clicks "Profile"
   ├─ GET /api/v1/doctor/profile
   ├─ Views/edits:
   │  ├─ Name, contact info
   │  ├─ Specialization
   │  ├─ License info
   │  └─ Profile photo
   ├─ PATCH /api/v1/doctor/profile
   └─ Changes saved

10. NOTIFICATIONS
    ├─ Views notification bell
    ├─ Sees:
    │  ├─ New case assignments
    │  ├─ System messages
    │  └─ Urgent alerts
    ├─ Marks as read
    └─ Takes action

11. SETTINGS
    ├─ Updates:
    │  ├─ Account (email, password)
    │  ├─ 2FA settings
    │  ├─ Notification preferences
    │  └─ Privacy settings
    └─ Changes saved

12. LOGOUT
    ├─ Clicks logout
    └─ Session ended
```

### 👤 Patient User Journey

```
1. PATIENT OPENS APPLICATION
   ├─ Visits http://app.com/patient
   ├─ Sees login form
   └─ Enters email & password

2. LOGIN
   ├─ Submits credentials
   ├─ POST /api/auth/login
   ├─ Receives JWT token
   └─ Home screen

3. UPLOAD LESION IMAGE
   ├─ Clicks "Analyze Lesion"
   ├─ Selects image from device
   ├─ Uploads to server
   ├─ POST /api/detection/predict
   └─ AI analyzes image

4. VIEW AI RESULTS
   ├─ Receives analysis
   ├─ Sees:
   │  ├─ Predicted diagnosis (%)
   │  ├─ Confidence score
   │  ├─ Alternative predictions
   │  └─ Recommendation
   └─ Can share results

5. SUBMIT TO DOCTOR
   ├─ Clicks "Submit for Review"
   ├─ Selects doctor from list
   ├─ (Optional) Adds notes
   ├─ POST /api/detection/cases/:detectionId/submit/:doctorId
   ├─ Case submitted successfully
   └─ Gets caseId

6. CHECK CASE STATUS
   ├─ Clicks "My Cases"
   ├─ GET /api/detection/my-cases
   ├─ Views submitted cases
   ├─ Sees status:
   │  ├─ Pending review (waiting)
   │  ├─ Under review (being analyzed)
   │  ├─ Approved (doctor's diagnosis)
   │  └─ Rejected (not melanoma)
   └─ Can view details

7. VIEW CASE DETAILS
   ├─ GET /api/detection/cases/:caseId
   ├─ If still pending:
   │  ├─ Shows assigned doctor
   │  └─ Estimated time
   ├─ If reviewed:
   │  ├─ Doctor's final diagnosis
   │  ├─ Doctor observations
   │  ├─ Clinical recommendations
   │  └─ Next steps
   └─ Can share with doctor/clinic

8. FOLLOW UP
   ├─ If approved (melanoma):
   │  ├─ Gets doctor contact info
   │  ├─ Schedule consultation
   │  └─ Receive recommendations
   ├─ If rejected (benign):
   │  ├─ Reassurance message
   │  └─ Can do follow-up scan later
   └─ Access case history

9. NOTIFICATIONS
   ├─ Gets notified when:
   │  ├─ Case is under review
   │  ├─ Case review is complete
   │  └─ Doctor sends message
   ├─ Can dismiss notifications
   └─ Checks notification history

10. PROFILE
    ├─ Views profile info
    ├─ Can update:
    │  ├─ Contact information
    │  ├─ Medical history
    │  └─ Preferences
    └─ Changes saved

11. LOGOUT
    ├─ Clicks logout
    └─ Session ended
```

---

## Summary Flowchart

```
APPLICATION STARTUP
  ├─ Client requests page
  ├─ Frontend framework loads
  ├─ Checks localStorage for token
  ├─ If token exists:
  │  ├─ Verify token with API
  │  ├─ Load user dashboard
  │  └─ Fetch initial data
  ├─ If no token:
  │  └─ Show login page
  │
USER ACTION (API CALL)
  ├─ User interacts with UI
  ├─ Frontend prepares request
  ├─ Send HTTP request with token
  │
SERVER PROCESSES REQUEST
  ├─ Parse request
  ├─ Verify authentication
  ├─ Check authorization
  ├─ Validate input
  ├─ Execute business logic
  ├─ Query database
  ├─ Log actions (audit)
  ├─ Format response
  │
CLIENT RECEIVES RESPONSE
  ├─ Parse response
  ├─ Check status
  ├─ Update UI
  ├─ Show notification
  └─ Ready for next action
```

---

**Dokumentasi selesai!**

Setiap alur proses dijelaskan dengan detail, mulai dari:
- 🏗️ Arsitektur sistem keseluruhan
- 🔐 Alur authentication & token verification
- 👨‍💼 Alur admin management lengkap
- 👨‍⚕️ Alur doctor dashboard & case review
- 👤 Alur patient detection & case submission
- 🔄 API request/response flow detail
- 💾 Database operations flow
- 👥 User journey by role

Gunakan dokumentasi ini sebagai panduan lengkap untuk memahami bagaimana aplikasi bekerja!
