# 🚀 Quick Start Guide - Doctor Dashboard API

## Getting Started

### 1. Start the Server
```bash
npm run dev
```
Server runs at: `http://localhost:3000`

---

## 🔐 Authentication

### Login as Doctor
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "elenaaris@icloud.com",
    "password": "password123"
  }'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "doctor"
}
```

**Copy the token and use it in all requests below:**
```
Authorization: Bearer <your_token>
```

---

## 📊 Dashboard Endpoints

### Get Dashboard Summary
```bash
curl -X GET http://localhost:3000/api/v1/doctor/dashboard/summary \
  -H "Authorization: Bearer <token>"
```

### Get Assigned Cases
```bash
curl -X GET http://localhost:3000/api/v1/doctor/cases/assigned \
  -H "Authorization: Bearer <token>"
```

### Get Case Details
```bash
curl -X GET http://localhost:3000/api/v1/doctor/cases/SK-9921 \
  -H "Authorization: Bearer <token>"
```

### Save Observation
```bash
curl -X POST http://localhost:3000/api/v1/doctor/cases/SK-9921/observation \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "physicianObservation": "The lesion appears benign. Recommend continued monitoring."
  }'
```

### Approve Case
```bash
curl -X PATCH http://localhost:3000/api/v1/doctor/cases/SK-9919/approve \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "physicianObservation": "Consistent with benign melanocytic nevus.",
    "finalDiagnosis": "Melanocytic Nevus"
  }'
```

### Reject Case
```bash
curl -X PATCH http://localhost:3000/api/v1/doctor/cases/SK-9918/reject \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "False positive prediction",
    "physicianObservation": "AI prediction does not match clinical features.",
    "finalDiagnosis": "Seborrheic Keratosis"
  }'
```

---

## 📜 Case History & Evolution

### Get Case History with Filters
```bash
curl -X GET "http://localhost:3000/api/v1/doctor/cases/history?status=approved&page=1&limit=10" \
  -H "Authorization: Bearer <token>"
```

**Query Parameters:**
- `search` - Search by patient name or case ID
- `diagnosis` - Filter by diagnosis
- `status` - pending_review, approved, rejected
- `startDate` - YYYY-MM-DD
- `endDate` - YYYY-MM-DD
- `page` - Page number
- `limit` - Results per page

### Get Patient Evolution
```bash
curl -X GET http://localhost:3000/api/v1/doctor/patients/P-001/evolution \
  -H "Authorization: Bearer <token>"
```

---

## 👤 Profile Endpoints

### Get Doctor Profile
```bash
curl -X GET http://localhost:3000/api/v1/doctor/profile \
  -H "Authorization: Bearer <token>"
```

### Update Doctor Profile
```bash
curl -X PATCH http://localhost:3000/api/v1/doctor/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Dr. Elena Aris",
    "phoneNumber": "+628134567890",
    "gender": "Female",
    "birthDate": "1996-04-23"
  }'
```

### Update Profile Photo
```bash
curl -X PATCH http://localhost:3000/api/v1/doctor/profile/photo \
  -H "Authorization: Bearer <token>" \
  -F "photo=@/path/to/photo.jpg"
```

---

## ⚙️ Settings Endpoints

### Get All Settings
```bash
curl -X GET http://localhost:3000/api/v1/doctor/settings \
  -H "Authorization: Bearer <token>"
```

### Update Account Settings (Email)
```bash
curl -X PATCH http://localhost:3000/api/v1/doctor/settings/account \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newemail@icloud.com"
  }'
```

### Update Password
```bash
curl -X PATCH http://localhost:3000/api/v1/doctor/settings/account \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "password123",
    "newPassword": "newSecurePassword123"
  }'
```

### Toggle 2FA
```bash
curl -X PATCH http://localhost:3000/api/v1/doctor/settings/2fa \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true
  }'
```

### Update Notification Settings
```bash
curl -X PATCH http://localhost:3000/api/v1/doctor/settings/notifications \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "emailNotifications": true,
    "verificationAlerts": false
  }'
```

### Update Privacy Settings
```bash
curl -X PATCH http://localhost:3000/api/v1/doctor/settings/privacy \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "dataVisibility": "restricted_clinical_team_only"
  }'
```

### Update Preferences
```bash
curl -X PATCH http://localhost:3000/api/v1/doctor/settings/preferences \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "language": "English (US)"
  }'
```

---

## 🔔 Notification Endpoints

### Get Notifications
```bash
curl -X GET http://localhost:3000/api/v1/doctor/notifications \
  -H "Authorization: Bearer <token>"
```

### Mark Single Notification as Read
```bash
curl -X PATCH http://localhost:3000/api/v1/doctor/notifications/N-001/read \
  -H "Authorization: Bearer <token>"
```

### Mark All Notifications as Read
```bash
curl -X PATCH http://localhost:3000/api/v1/doctor/notifications/read-all \
  -H "Authorization: Bearer <token>"
```

---

## 📊 Sample Data Available

### Doctors:
1. **Dr. Elena Aris**
   - Email: `elenaaris@icloud.com`
   - Password: `password123`
   - Status: Verified

2. **Dr. James Mitchell**
   - Email: `jamesmitchell@clinic.com`
   - Password: `password123`
   - Status: Verified

### Cases:
- **SK-9921**: Sarah Johnson (42F) - Approved
- **SK-9920**: Michael Chen (55M) - Approved
- **SK-9919**: Emma Wilson (38F) - Pending (ready to approve/reject)
- **SK-9918**: Robert Taylor (62M) - Rejected

### Patients for Evolution:
- P-001, P-002, P-003, P-004

---

## 🧪 Test Workflow

1. **Login** to get token
2. **Get Dashboard Summary** to see stats
3. **Get Assigned Cases** to see pending reviews
4. **Get Case Details** for SK-9919 (pending case)
5. **Approve Case** SK-9919 with physician observation
6. **Get Case History** to see approved cases
7. **Get Patient Evolution** for P-001
8. **Get Profile** to see doctor information
9. **Update Settings** to change preferences
10. **Get Notifications** to see system messages

---

## 💡 Tips

- Use Postman or Insomnia for easier testing with saved requests
- Copy token to environment variable in Postman
- Test pagination: `?page=1&limit=5`
- Test filters: `?status=approved&search=sarah`
- Check DOCTOR_API_DOCUMENTATION.md for detailed specifications
- All responses use consistent JSON format with status field

---

## 📋 API Endpoint Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard/summary` | Dashboard statistics |
| GET | `/cases/assigned` | Assigned pending cases |
| GET | `/cases/:caseId` | Case details with AI predictions |
| POST | `/cases/:caseId/observation` | Save physician notes |
| PATCH | `/cases/:caseId/approve` | Approve AI diagnosis |
| PATCH | `/cases/:caseId/reject` | Reject AI diagnosis |
| GET | `/cases/history` | Case history with pagination |
| GET | `/patients/:patientId/evolution` | Patient lesion evolution |
| GET | `/profile` | Doctor profile |
| PATCH | `/profile` | Update profile |
| PATCH | `/profile/photo` | Update profile photo |
| GET | `/settings` | All settings |
| PATCH | `/settings/account` | Account settings |
| PATCH | `/settings/2fa` | 2FA settings |
| PATCH | `/settings/notifications` | Notification preferences |
| PATCH | `/settings/privacy` | Privacy settings |
| PATCH | `/settings/preferences` | System preferences |
| GET | `/notifications` | Get notifications |
| PATCH | `/notifications/:id/read` | Mark as read |
| PATCH | `/notifications/read-all` | Mark all as read |

**Total: 23 Endpoints**

---

**Ready to test! 🎉**
