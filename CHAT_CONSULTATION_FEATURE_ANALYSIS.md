# Chat & Consultation Feature Analysis

**Status**: ⚠️ PARTIAL IMPLEMENTATION - Schema ada, butuh fitur lengkap
**Tanggal**: May 2026
**Last Updated**: 2026-05-21

---

## 📋 Table of Contents

1. [Current Status](#current-status)
2. [Architecture Overview](#architecture-overview)
3. [Database Schema Analysis](#database-schema-analysis)
4. [Feature Flow & Process](#feature-flow--process)
5. [Implementation Checklist](#implementation-checklist)
6. [Testing Guide](#testing-guide)
7. [Troubleshooting](#troubleshooting)

---

## Current Status

### ✅ Yang Sudah Ada

```
Schema Prisma:
├── Consultation model ✅
│   ├── id (UUID)
│   ├── status (OPEN/CLOSED)
│   ├── scanId (Foreign Key ke Scan)
│   ├── patientId (Foreign Key ke User)
│   ├── doctorId (Foreign Key ke User)
│   ├── messages (Relation ke ChatMessage)
│   └── timestamps (createdAt, updatedAt)
│
└── ChatMessage model ✅
    ├── id (UUID)
    ├── message (Text)
    ├── timestamp
    ├── consultationId (Foreign Key)
    ├── senderId (Foreign Key ke User)
    └── sender (Relation ke User)
```

### ❌ Yang Belum Ada

```
Implementation:
├── Controllers:
│   ├── chat.controller.js ❌
│   └── consultation.controller.js ❌
│
├── Services:
│   ├── chat.service.js ❌
│   └── consultation.service.js ❌
│
├── Routes:
│   ├── chat.route.js ❌
│   └── consultation.route.js ❌
│
├── Validators:
│   ├── chat.validator.js ❌
│   └── consultation.validator.js ❌
│
└── Real-time Features:
    └── WebSocket/Socket.io ❌ (untuk real-time chat)
```

---

## Architecture Overview

### System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    PATIENT FRONTEND                              │
│                  (Lihat Scan Results)                            │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ↓ Upload & Analyze Scan
┌─────────────────────────────────────────────────────────────────┐
│                   BACKEND SERVICE                                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Step 1: AI Analysis                                       │  │
│  │ - Predict melanoma/benign                                 │  │
│  │ - Store in Scan table                                     │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                     │
                     ↓ Request Consultation
┌──────────────────────────────────────────────────────────────────┐
│                 CREATE CONSULTATION                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Step 2: Initialize Consultation                           │  │
│  │ - Link: Scan + Patient + Doctor                           │  │
│  │ - Set Status: OPEN                                        │  │
│  │ - Create Consultation record                              │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                     │
         ┌───────────┴────────────┐
         ↓                        ↓
    PATIENT CHAT              DOCTOR CHAT
    (Frontend)                (Frontend)
         │                        │
         └───────────┬────────────┘
                     ↓
         ┌──────────────────────┐
         │  SEND MESSAGE        │
         │  - Store in DB       │
         │  - Real-time notify  │
         │  - Websocket update  │
         └──────────────────────┘
                     │
         ┌───────────┴────────────┐
         ↓                        ↓
   Patient reads          Doctor reads
   & respond              & respond
         │                        │
         └───────────┬────────────┘
                     ↓
         ┌──────────────────────┐
         │  CLOSE CONSULTATION  │
         │  - Doctor provides   │
         │    final diagnosis   │
         │  - Status: CLOSED    │
         │  - Create Report     │
         └──────────────────────┘
                     │
                     ↓
              PATIENT REPORT
```

---

## Database Schema Analysis

### Consultation Table Structure

```sql
Table: consultation
├── id (UUID, Primary Key)
├── status (Enum: OPEN, CLOSED)
├── scanId (FK → scan.id, UNIQUE)
├── patientId (FK → user.id)
├── doctorId (FK → user.id)
├── createdAt (Timestamp)
└── updatedAt (Timestamp)

Relationships:
├── 1 Consultation : 1 Scan (via scanId)
├── 1 Consultation : 1 Patient (via patientId)
├── 1 Consultation : 1 Doctor (via doctorId)
└── 1 Consultation : Many ChatMessages (via consultationId)
```

### ChatMessage Table Structure

```sql
Table: chatMessage
├── id (UUID, Primary Key)
├── message (Text)
├── timestamp (Datetime, default: now())
├── consultationId (FK → consultation.id, onDelete: CASCADE)
└── senderId (FK → user.id)

Relationships:
├── Many ChatMessages : 1 Consultation
└── Many ChatMessages : 1 User (sender)

Features:
├── Auto-delete messages jika consultation dihapus
├── Immutable message (tidak bisa diedit)
└── Timestamp terrekam automatic
```

### Data Relationships

```
User (Patient)
  │
  ├─→ patientConsultations (Relation "PatientToConsultation")
  │    └─→ Consultation
  │         ├─→ Scan
  │         ├─→ Doctor (User)
  │         └─→ ChatMessages
  │              └─→ sender (User)
  │
  └─→ messages (Relation)
       └─→ ChatMessage

User (Doctor)
  │
  ├─→ doctorConsultations (Relation "DoctorToConsultation")
  │    └─→ Consultation
  │         ├─→ Scan
  │         ├─→ Patient (User)
  │         └─→ ChatMessages
  │
  └─→ messages (Relation)
       └─→ ChatMessage
```

---

## Feature Flow & Process

### 1️⃣ Scan Upload & Analysis (Already Implemented)

```
Patient Action:
1. Upload lesion image
   POST /api/v1/patient/scans/upload
   
2. AI Analyzes
   Automatic AI analysis menggunakan Python/ML service
   Results: aiPrediction, aiConfidence
   
3. Scan Ready for Consultation
   Scan status: isAnalyzed = true
```

### 2️⃣ Initiate Consultation (NEW)

```
Patient Action:
POST /api/v1/patient/consultations/initiate
{
  "scanId": "uuid-scan",
  "doctorId": "uuid-doctor",
  "initialMessage": "Saya khawatir dengan mole ini, bisakah di-review?"
}

Flow:
1. Validate scan exists & belongs to patient
2. Validate doctor exists & has verified status
3. Create Consultation record
4. Create first ChatMessage
5. Send notification to doctor
6. Return consultation + messages

Response:
{
  "status": "success",
  "data": {
    "consultationId": "uuid-consul",
    "status": "OPEN",
    "scanId": "uuid-scan",
    "patientId": "uuid-patient",
    "doctorId": "uuid-doctor",
    "messages": [
      {
        "id": "uuid-msg",
        "message": "Saya khawatir dengan mole ini...",
        "senderId": "uuid-patient",
        "timestamp": "2026-05-21T10:00:00Z"
      }
    ],
    "createdAt": "2026-05-21T10:00:00Z"
  }
}
```

### 3️⃣ Get Consultation List (NEW)

```
Patient View:
GET /api/v1/patient/consultations
Query Params:
  - status: OPEN, CLOSED (optional)
  - page: 1, limit: 10 (optional)

Doctor View:
GET /api/v1/doctor/consultations
Query Params:
  - status: OPEN, CLOSED (optional)
  - patientId: filter by patient (optional)

Response:
{
  "status": "success",
  "data": {
    "consultations": [
      {
        "id": "uuid-consul",
        "status": "OPEN",
        "scan": { id, scanId, imageUrl, aiPrediction },
        "partner": { id, name, email, role },
        "unreadCount": 2,
        "lastMessage": { message, timestamp },
        "createdAt": "2026-05-21T10:00:00Z"
      }
    ],
    "pagination": { page: 1, limit: 10, total: 15 }
  }
}
```

### 4️⃣ Send Message (NEW)

```
Patient/Doctor Action:
POST /api/v1/patient/consultations/:consultationId/messages
{
  "message": "Looks like benign mole, monitoring recommended"
}

Flow:
1. Verify user is participant (patient atau doctor)
2. Verify consultation exists & status OPEN
3. Create ChatMessage record
4. Emit WebSocket event to partner
5. Update consultation updatedAt

Response:
{
  "status": "success",
  "data": {
    "id": "uuid-msg",
    "consultationId": "uuid-consul",
    "message": "Looks like benign mole...",
    "senderId": "uuid-sender",
    "sender": { name, email },
    "timestamp": "2026-05-21T10:05:00Z"
  }
}
```

### 5️⃣ Get Chat History (NEW)

```
GET /api/v1/patient/consultations/:consultationId/messages
Query Params:
  - page: 1, limit: 50 (pagination)
  - sort: asc/desc (default: asc)

Response:
{
  "status": "success",
  "data": {
    "messages": [
      {
        "id": "uuid-msg",
        "message": "...",
        "senderId": "uuid-sender",
        "sender": { name, avatar },
        "timestamp": "2026-05-21T10:00:00Z"
      }
    ],
    "pagination": { page: 1, limit: 50, total: 25 }
  }
}
```

### 6️⃣ Close Consultation & Create Report (NEW)

```
Doctor Action:
PATCH /api/v1/doctor/consultations/:consultationId/close
{
  "finalDiagnosis": "Benign nevi, melanoma risk low",
  "recommendation": "Routine monitoring every 6 months"
}

Flow:
1. Verify user is doctor in consultation
2. Create CaseReview record (jika belum ada)
3. Create Report record
4. Set consultation status: CLOSED
5. Notify patient
6. Return closed consultation with report

Response:
{
  "status": "success",
  "data": {
    "consultationId": "uuid-consul",
    "status": "CLOSED",
    "report": {
      "id": "uuid-report",
      "reportId": "RPT-xxxxx",
      "finalDiagnosis": "Benign nevi...",
      "recommendation": "Routine monitoring...",
      "pdfUrl": null, // Generated later
      "createdAt": "2026-05-21T10:10:00Z"
    }
  }
}
```

### 7️⃣ Mark Messages as Read (NEW)

```
Patient/Doctor Action:
PATCH /api/v1/patient/consultations/:consultationId/read
{
  "messageIds": ["uuid-msg1", "uuid-msg2"]
}

OR Mark all:
PATCH /api/v1/patient/consultations/:consultationId/read-all

Flow:
1. Update message read status
2. Return updated messages
```

---

## Implementation Checklist

### Phase 1: Validators ✅ FIRST

**File**: `src/validators/consultation.validator.js`

```javascript
// Validators needed:
validateInitiateConsultation()
  ├─ scanId: required, string (UUID format)
  ├─ doctorId: required, string (UUID format)
  ├─ initialMessage: required, min 5 chars, max 1000 chars
  └─ Validate scan exists & analyzed
  └─ Validate doctor exists & verified

validateSendMessage()
  ├─ message: required, min 1 char, max 2000 chars
  ├─ consultationId: required
  └─ Validate user is participant

validateCloseConsultation()
  ├─ finalDiagnosis: required, min 10 chars, max 1000 chars
  ├─ recommendation: optional, max 2000 chars
  └─ Validate user is doctor

validatePaginationParams()
  ├─ page: optional, min 1
  ├─ limit: optional, min 1, max 100
  └─ sort: optional, "asc" or "desc"
```

### Phase 2: Services ✅ SECOND

**File**: `src/services/consultation.service.js`

```javascript
// Consultation Service
initiateConsultation(patientId, scanId, doctorId, message)
getConsultationList(userId, role, filters)
getConsultationDetail(consultationId, userId)
closeConsultation(consultationId, doctorId, diagnosis, recommendation)

// Chat Service
sendMessage(consultationId, senderId, message)
getChatMessages(consultationId, page, limit, sort)
markMessagesAsRead(consultationId, messageIds)
getUnreadCount(userId)

// Helper functions
validateConsultationParticipant(consultationId, userId)
validateConsultationOpen(consultationId)
```

### Phase 3: Controllers ✅ THIRD

**File**: `src/controllers/consultation.controller.js`

```javascript
initiateConsultation(req, res)
getConsultations(req, res)
getConsultationDetail(req, res)
sendMessage(req, res)
getChatMessages(req, res)
closeConsultation(req, res)
markAsRead(req, res)
markAllAsRead(req, res)
```

### Phase 4: Routes ✅ FOURTH

**File**: `src/routes/consultation.route.js`

```javascript
// Patient routes
POST /api/v1/patient/consultations/initiate
GET /api/v1/patient/consultations
GET /api/v1/patient/consultations/:consultationId
POST /api/v1/patient/consultations/:consultationId/messages
GET /api/v1/patient/consultations/:consultationId/messages
PATCH /api/v1/patient/consultations/:consultationId/read
PATCH /api/v1/patient/consultations/:consultationId/read-all

// Doctor routes
GET /api/v1/doctor/consultations
GET /api/v1/doctor/consultations/:consultationId
POST /api/v1/doctor/consultations/:consultationId/messages
GET /api/v1/doctor/consultations/:consultationId/messages
PATCH /api/v1/doctor/consultations/:consultationId/close
PATCH /api/v1/doctor/consultations/:consultationId/read
PATCH /api/v1/doctor/consultations/:consultationId/read-all
```

### Phase 5: WebSocket Real-time (OPTIONAL)

```javascript
// For production, consider Socket.io
- On connection: join consultation room
- On message:send: broadcast to room
- On typing: show typing indicator
- On disconnect: leave room
```

---

## Testing Guide

### ⚙️ Prerequisites

```bash
# 1. Ensure PostgreSQL running
# 2. Database migrated
npx prisma migrate deploy

# 3. Seed data (optional)
node prisma/seed.js

# 4. Start server
npm start
```

### 🧪 Test Scenarios

---

### Test 1: Initiate Consultation

**Step 1**: Login as Patient

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "patient@mail.com",
    "password": "password123"
  }'

# Save token: PATIENT_TOKEN
# Save patientId: PATIENT_ID
```

**Step 2**: Login as Doctor

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "doctor@mail.com",
    "password": "password123"
  }'

# Save token: DOCTOR_TOKEN
# Save doctorId: DOCTOR_ID
```

**Step 3**: Get Patient Scans

```bash
curl -X GET http://localhost:3000/api/v1/patient/scans \
  -H "Authorization: Bearer PATIENT_TOKEN"

# Response: [ { id: SCAN_ID, isAnalyzed: true, ... } ]
# Save scanId: SCAN_ID
```

**Step 4**: Initiate Consultation

```bash
curl -X POST http://localhost:3000/api/v1/patient/consultations/initiate \
  -H "Authorization: Bearer PATIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "scanId": "SCAN_ID",
    "doctorId": "DOCTOR_ID",
    "initialMessage": "Saya khawatir dengan mole di lengan saya. Bisakah dianalisis lebih lanjut?"
  }'

# Response:
# {
#   "status": "success",
#   "data": {
#     "id": "CONSULTATION_ID",
#     "status": "OPEN",
#     "scanId": "SCAN_ID",
#     "patientId": "PATIENT_ID",
#     "doctorId": "DOCTOR_ID",
#     "messages": [{ message: "...", senderId: "PATIENT_ID" }]
#   }
# }

# Save consultationId: CONSULTATION_ID
```

**Expected Result**: ✅
- Consultation created
- ChatMessage stored
- Status = OPEN
- Doctor receives notification

---

### Test 2: Patient Views Consultations

```bash
curl -X GET http://localhost:3000/api/v1/patient/consultations \
  -H "Authorization: Bearer PATIENT_TOKEN"

# Response:
# {
#   "status": "success",
#   "data": {
#     "consultations": [
#       {
#         "id": "CONSULTATION_ID",
#         "status": "OPEN",
#         "scan": { imageUrl, aiPrediction },
#         "partner": { name, email },
#         "lastMessage": { message, timestamp },
#         "unreadCount": 1
#       }
#     ]
#   }
# }
```

**Expected Result**: ✅
- List konsultasi patient
- Unread count visible
- Last message preview

---

### Test 3: Doctor Views Consultation Detail

```bash
curl -X GET http://localhost:3000/api/v1/doctor/consultations/CONSULTATION_ID \
  -H "Authorization: Bearer DOCTOR_TOKEN"

# Response:
# {
#   "status": "success",
#   "data": {
#     "id": "CONSULTATION_ID",
#     "status": "OPEN",
#     "scan": { id, imageUrl, complaint, aiPrediction, aiConfidence },
#     "patient": { id, name, email, profile },
#     "messages": [ first few messages ],
#     "createdAt": "..."
#   }
# }
```

**Expected Result**: ✅
- Can see full scan details with AI prediction
- See patient's initial message
- Can review full context

---

### Test 4: Send Messages (Back & Forth)

**Doctor sends message**:
```bash
curl -X POST http://localhost:3000/api/v1/doctor/consultations/CONSULTATION_ID/messages \
  -H "Authorization: Bearer DOCTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Berdasarkan analisis AI dan pemeriksaan visual, ini menunjukkan karakteristik benign mole. Tidak ada tanda-tanda melanoma berbahaya."
  }'

# Response:
# {
#   "status": "success",
#   "data": {
#     "id": "MESSAGE_ID_1",
#     "consultationId": "CONSULTATION_ID",
#     "message": "Berdasarkan analisis...",
#     "senderId": "DOCTOR_ID",
#     "sender": { name: "Dr. John" },
#     "timestamp": "2026-05-21T10:05:00Z"
#   }
# }
```

**Patient sends reply**:
```bash
curl -X POST http://localhost:3000/api/v1/patient/consultations/CONSULTATION_ID/messages \
  -H "Authorization: Bearer PATIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Terima kasih banyak Dr. John. Jadi saya tidak perlu khawatir? Apa yang harus saya lakukan?"
  }'

# Response: Message stored with senderId = PATIENT_ID
```

**Expected Result**: ✅
- Messages stored in correct order
- Timestamps accurate
- Both can read each other's messages
- Message appear in chat history

---

### Test 5: Get Chat History with Pagination

```bash
# Get first 10 messages
curl -X GET "http://localhost:3000/api/v1/patient/consultations/CONSULTATION_ID/messages?page=1&limit=10&sort=asc" \
  -H "Authorization: Bearer PATIENT_TOKEN"

# Response:
# {
#   "status": "success",
#   "data": {
#     "messages": [
#       {
#         "id": "msg-1",
#         "message": "Saya khawatir...",
#         "senderId": "PATIENT_ID",
#         "sender": { name: "Sarah" },
#         "timestamp": "2026-05-21T10:00:00Z"
#       },
#       {
#         "id": "msg-2",
#         "message": "Berdasarkan analisis...",
#         "senderId": "DOCTOR_ID",
#         "sender": { name: "Dr. John" },
#         "timestamp": "2026-05-21T10:05:00Z"
#       }
#     ],
#     "pagination": {
#       "page": 1,
#       "limit": 10,
#       "total": 3,
#       "hasMore": false
#     }
#   }
# }
```

**Expected Result**: ✅
- All messages visible in timeline
- Correct sender info
- Proper pagination
- Chronological order

---

### Test 6: Close Consultation

**Doctor closes consultation**:
```bash
curl -X PATCH http://localhost:3000/api/v1/doctor/consultations/CONSULTATION_ID/close \
  -H "Authorization: Bearer DOCTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "finalDiagnosis": "Benign melanocytic nevus dengan low melanoma risk index",
    "recommendation": "Monitoring setiap 6 bulan atau jika ada perubahan ukuran/warna"
  }'

# Response:
# {
#   "status": "success",
#   "data": {
#     "consultationId": "CONSULTATION_ID",
#     "status": "CLOSED",
#     "report": {
#       "id": "REPORT_ID",
#       "reportId": "RPT-xxxxx",
#       "finalDiagnosis": "Benign melanocytic...",
#       "recommendation": "Monitoring setiap 6...",
#       "createdAt": "2026-05-21T10:10:00Z"
#     },
#     "closedAt": "2026-05-21T10:10:00Z"
#   }
# }
```

**Expected Result**: ✅
- Consultation status = CLOSED
- Cannot send more messages
- Report created
- Patient receives final diagnosis
- Patient can download/view report

---

### Test 7: Verify Access Control

**Patient tries to send message in closed consultation**:
```bash
curl -X POST http://localhost:3000/api/v1/patient/consultations/CONSULTATION_ID/messages \
  -H "Authorization: Bearer PATIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "message": "Hi doctor" }'

# Expected Response: 400/409
# {
#   "status": "error",
#   "message": "Consultation sudah ditutup, tidak bisa mengirim pesan"
# }
```

**Patient tries to access doctor's consultation**:
```bash
curl -X GET http://localhost:3000/api/v1/patient/consultations/WRONG_CONSULTATION_ID \
  -H "Authorization: Bearer PATIENT_TOKEN"

# Expected Response: 403
# {
#   "status": "error",
#   "message": "Anda tidak memiliki akses ke konsultasi ini"
# }
```

**Expected Result**: ✅
- Proper authorization checks
- Only participants can access
- Cannot modify closed consultations
- Proper error messages

---

### Test 8: Error Handling

**Invalid Scan ID**:
```bash
curl -X POST http://localhost:3000/api/v1/patient/consultations/initiate \
  -H "Authorization: Bearer PATIENT_TOKEN" \
  -d '{
    "scanId": "invalid-uuid",
    "doctorId": "DOCTOR_ID",
    "initialMessage": "Test"
  }'

# Expected: 400 - Validation error
```

**Non-existent Doctor**:
```bash
curl -X POST http://localhost:3000/api/v1/patient/consultations/initiate \
  -H "Authorization: Bearer PATIENT_TOKEN" \
  -d '{
    "scanId": "SCAN_ID",
    "doctorId": "non-existent-doctor",
    "initialMessage": "Test"
  }'

# Expected: 404 - Doctor not found
```

**Unverified Doctor**:
```bash
curl -X POST http://localhost:3000/api/v1/patient/consultations/initiate \
  -H "Authorization: Bearer PATIENT_TOKEN" \
  -d '{
    "scanId": "SCAN_ID",
    "doctorId": "UNVERIFIED_DOCTOR_ID",
    "initialMessage": "Test"
  }'

# Expected: 400 - Doctor not verified
```

**Expected Result**: ✅
- Proper validation messages
- Clear error responses
- No data leakage
- HTTP status codes correct

---

## Troubleshooting

### Issue 1: Consultation not created
**Symptoms**: POST returns 500 or 404
**Check**:
1. Is scan ID valid? → `SELECT * FROM "Scan" WHERE id = 'SCAN_ID'`
2. Is doctor verified? → `SELECT * FROM "DoctorProfile" WHERE userId = 'DOCTOR_ID' AND verificationStatus = 'verified'`
3. Is scan analyzed? → Check `isAnalyzed = true`

### Issue 2: Messages not appearing
**Symptoms**: Messages created but not retrievable
**Check**:
1. Is consultationId valid? → `SELECT * FROM "Consultation" WHERE id = 'CONSULTATION_ID'`
2. Is consultation open? → `status = 'OPEN'`
3. Check message count → `SELECT COUNT(*) FROM "ChatMessage" WHERE consultationId = 'CONSULTATION_ID'`

### Issue 3: Access denied errors
**Symptoms**: 403 Forbidden on valid endpoints
**Check**:
1. Is user token valid? → Check JWT expiration
2. Is user a participant? → `SELECT * FROM "Consultation" WHERE (patientId = 'USER_ID' OR doctorId = 'USER_ID') AND id = 'CONSULTATION_ID'`
3. Is consultation belong to user? → Verify relationships

### Issue 4: Database constraints
**Symptoms**: 409 Conflict or foreign key errors
**Check**:
1. Scan can only have 1 consultation → `UNIQUE constraint on scanId`
2. Check cascade deletes working → Delete consultation → messages should auto-delete
3. Verify referential integrity

---

## Database Queries for Testing

```sql
-- View all consultations
SELECT * FROM "Consultation" ORDER BY "createdAt" DESC;

-- View all chat messages
SELECT * FROM "ChatMessage" ORDER BY "timestamp" ASC;

-- Find consultation by patient
SELECT * FROM "Consultation" 
WHERE "patientId" = 'PATIENT_ID'
ORDER BY "createdAt" DESC;

-- Find consultation by doctor
SELECT * FROM "Consultation" 
WHERE "doctorId" = 'DOCTOR_ID'
ORDER BY "createdAt" DESC;

-- Get messages in conversation
SELECT c."id" as "consultationId",
       c."status",
       m."id" as "messageId",
       m."message",
       u."name" as "senderName",
       m."timestamp"
FROM "Consultation" c
LEFT JOIN "ChatMessage" m ON c."id" = m."consultationId"
LEFT JOIN "User" u ON m."senderId" = u."id"
WHERE c."id" = 'CONSULTATION_ID'
ORDER BY m."timestamp" ASC;

-- Count unread messages for user
SELECT c."id",
       COUNT(m."id") as "unreadCount"
FROM "Consultation" c
LEFT JOIN "ChatMessage" m ON c."id" = m."consultationId"
WHERE (c."patientId" = 'USER_ID' OR c."doctorId" = 'USER_ID')
  AND m."senderId" != 'USER_ID'
GROUP BY c."id";

-- Check consultation statistics
SELECT 
  COUNT(*) as "totalConsultations",
  SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) as "openConsultations",
  SUM(CASE WHEN status = 'CLOSED' THEN 1 ELSE 0 END) as "closedConsultations"
FROM "Consultation";
```

---

## Implementation Notes

### Considerations

1. **Message Immutability**
   - Messages should not be editable (audit trail required)
   - Only soft-delete if absolutely necessary
   - Keep all historical data

2. **Real-time Communication**
   - Current design is REST-based
   - For production, implement WebSocket/Socket.io
   - Reduces polling, better UX
   - Keep-alive heartbeat for connection

3. **Notification Strategy**
   - When message sent → notify recipient
   - Use email/SMS for critical updates
   - In-app notification badge
   - Desktop notifications (PWA)

4. **Report Generation**
   - When consultation closed → auto-generate report
   - Option: Generate PDF
   - Store in cloud storage (S3/Cloudinary)
   - Patient can download/share

5. **Data Privacy**
   - Only participants can view messages
   - Doctor cannot access other doctor's consultations
   - Patient cannot view other patient's chats
   - Proper audit logging

6. **Performance Optimization**
   - Index on (consultationId, timestamp) for messages
   - Pagination essential for long chats
   - Cache recently accessed consultations
   - Optimize N+1 queries with proper relations

---

## Next Steps

1. ✅ Create `src/validators/consultation.validator.js`
2. ✅ Create `src/services/consultation.service.js`
3. ✅ Create `src/controllers/consultation.controller.js`
4. ✅ Create `src/routes/consultation.route.js`
5. ✅ Update `server.js` to register new routes
6. ✅ Run tests using this guide
7. ⏳ (Optional) Add WebSocket support
8. ⏳ (Optional) Add PDF report generation
9. ⏳ (Optional) Add notification service

---

## References

- Schema: [prisma/schema.prisma](prisma/schema.prisma)
- Patient API: [PATIENT_API_DOCUMENTATION.md](PATIENT_API_DOCUMENTATION.md)
- Doctor API: [DOCTOR_API_DOCUMENTATION.md](DOCTOR_API_DOCUMENTATION.md)
- Application Flow: [APPLICATION_FLOW.md](APPLICATION_FLOW.md)
