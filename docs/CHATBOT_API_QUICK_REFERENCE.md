# 🚀 Chatbot API - Quick Reference Guide

## 📁 Documentation Files

### 1. **Postman Collection** (Recommended for API Testing)
- **File**: `postman-chat-and-chatbot.collection.json`
- **Environment**: `postman-chat-and-chatbot.environment.json`
- **Contains**: Patient-doctor chat consultation, AI chatbot, read receipts, typing status, SSE, prescriptions, and close/delete consultation flow.
- **How to Use**:
  1. Open Postman → Import → Select both files
  2. Update `{{baseUrl}}` based on your environment
  3. Run endpoints in order from the collection

### 2. **Full Postman Collection** (Older Complete Collection)
- **File**: `postman-chatbot-api-complete.collection.json`
- **How to Use**:
  1. Open Postman → Import → Select this file
  2. Update `{{baseUrl}}` variable based on your environment
  3. Run endpoints in order from the collection

### 3. **Full Documentation** (Technical Details)
- **File**: `CHATBOT_API_DOCUMENTATION.md`
- **Contains**: Complete API reference, data models, examples, best practices

### 4. **Original Postman Collection** (Legacy)
- **File**: `postman-chat-consultation.collection.json`
- **Status**: Kept for backward compatibility

---

## ⚡ Quick Start (5 Minutes)

### Step 1: Login Patient
```bash
POST /api/auth/login
{
  "email": "sarah.johnson@myskin.local",
  "password": "password123"
}
# Save: {{patientToken}}
```

### Step 2: Login Doctor
```bash
POST /api/auth/login
{
  "email": "elena.aris@myskin.local",
  "password": "password123"
}
# Save: {{doctorToken}}
```

### Step 3: Get Doctor Profile
```bash
GET /api/v1/doctor/profile
Authorization: Bearer {{doctorToken}}
# Save: {{doctorId}}
```

### Step 4: Start Consultation
```bash
POST /api/v1/patient/consultations/initiate
Authorization: Bearer {{patientToken}}
{
  "doctorId": "{{doctorId}}",
  "scanId": "SCAN-SARAH-MAY-2026",
  "initialMessage": "Halo dokter, butuh konsultasi."
}
# Save: {{consultationId}}
```

### Step 5: Send Message
```bash
POST /api/v1/patient/consultations/{{consultationId}}/messages
Authorization: Bearer {{patientToken}}
{
  "message": "Apakah hasil scan ini perlu pemeriksaan lanjutan?"
}
```

### Step 6: Doctor Responds
```bash
POST /api/v1/doctor/consultations/{{consultationId}}/messages
Authorization: Bearer {{doctorToken}}
{
  "message": "Hasil baik, pantau 3 bulan ke depan."
}
```

### Step 7: Close Consultation
```bash
PATCH /api/v1/doctor/consultations/{{consultationId}}/close
Authorization: Bearer {{doctorToken}}
{
  "diagnosis": "Benign Nevus",
  "recommendation": "Pantau perubahan",
  "notes": "Tidak ada tanda keganasan"
}
```

---

## 📊 API Endpoints Summary

### Authentication
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/login` | POST | Login user |
| `/api/auth/forgot-password` | POST | Request password reset |
| `/api/auth/reset-password` | POST | Reset password |

### Patient Consultation
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/patient/consultations/initiate` | POST | Create consultation |
| `/api/v1/patient/consultations` | GET | List consultations |
| `/api/v1/patient/consultations/:id` | GET | View detail |
| `/api/v1/patient/consultations/:id/messages` | POST | Send message |
| `/api/v1/patient/consultations/:id/messages` | GET | Get chat history |
| `/api/v1/patient/consultations/:id/read` | PATCH | Mark as read |
| `/api/v1/patient/consultations/:id/read-all` | PATCH | Mark all as read |

### Doctor Consultation
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/doctor/consultations` | GET | List consultations |
| `/api/v1/doctor/consultations/:id` | GET | View detail |
| `/api/v1/doctor/consultations/:id/messages` | POST | Send message |
| `/api/v1/doctor/consultations/:id/messages` | GET | Get chat history |
| `/api/v1/doctor/consultations/:id/ai-analysis` | GET | View AI details |
| `/api/v1/doctor/consultations/:id/close` | PATCH | Close & create report |
| `/api/v1/doctor/consultations/:id/prescriptions` | POST | Add prescription |
| `/api/v1/doctor/consultations/:id` | DELETE | Delete (closed only) |

### Real-time
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/patient/consultations/:id/events` | GET | SSE stream |
| `/api/v1/doctor/consultations/:id/events` | GET | SSE stream |
| `/api/v1/patient/consultations/:id/typing` | POST | Send typing status |
| `/api/v1/doctor/consultations/:id/typing` | POST | Send typing status |

---

## 🔐 Demo Credentials

### Patients
- **Email**: sarah.johnson@myskin.local
- **Email**: robert.taylor@myskin.local
- **Email**: michael.chen@myskin.local
- **Password**: `password123`

### Doctors
- **Email**: elena.aris@myskin.local
- **Email**: james.mitchell@myskin.local
- **Password**: `password123`

### Demo Scans
- `SCAN-SARAH-MAY-2026`
- `SCAN-ROBERT-APR-2026`
- `SCAN-MICHAEL-MAY-2026`

---

## 🌍 Environment URLs

| Environment | Base URL |
|-------------|----------|
| **Development** | `http://localhost:3300` |
| **Staging** | `https://api-staging.myskin.local` |
| **Production** | `https://api.myskin.local` |

---

## 💡 Key Concepts

### Consultation Status
- **OPEN**: Active consultation, can send messages
- **CLOSED**: Archived consultation, report generated

### Prescription Status
- **PENDING**: Belum diberikan ke patient
- **ACTIVE**: Patient using prescription
- **COMPLETED**: Prescription selesai

### Case Disposition
- **case_resolved**: Kasus selesai
- **follow_up_required**: Perlu follow-up
- **referral_needed**: Perlu rujukan

---

## 🔄 Typical Workflows

### Patient Initiates Consultation
```
Patient Login → Get Doctor Profile → Initiate Consultation 
→ Send Initial Message → Receive Doctor Response 
→ Continue Chat → View Report
```

### Doctor Reviews & Closes
```
Doctor Login → Get Consultation List → Review Scan & AI Analysis 
→ Send Analysis Message → Create Prescription 
→ Close Consultation → Report Auto-Generated
```

### Real-time Chat
```
Connect SSE Stream → Listen for Events 
→ Send Typing Status → Receive Messages 
→ Send Messages → Keep Connection Alive
```

---

## ⚠️ Common Issues & Solutions

### Issue 1: "Unauthorized" Error
**Solution**: 
- Check token is valid (not expired)
- Include "Authorization: Bearer {{token}}" in header
- Regenerate token with login endpoint

### Issue 2: "Consultation Not Found"
**Solution**:
- Verify {{consultationId}} is correct
- Check consultation belongs to current user
- Make sure consultation is OPEN (not CLOSED)

### Issue 3: "Doctor Profile Not Found"
**Solution**:
- Run "Get Doctor Profile" endpoint first
- Check doctor email is correct
- Doctor must be verified status

### Issue 4: SSE Connection Drops
**Solution**:
- Implement auto-reconnect logic
- Check internet connection
- Verify Authorization header is present
- Use EventSource with automatic retry

### Issue 5: Attachment Upload Fails
**Solution**:
- Check file size < 5MB each
- Max 5 files per message
- Use form-data, not JSON body
- Check file mime type

---

## 📈 Performance Tips

### For Developers
1. **Pagination**: Use `?page=1&limit=20` for lists
2. **Caching**: Cache doctor profiles locally
3. **Debouncing**: Debounce typing status (max 1x per 300ms)
4. **Lazy Load**: Load messages on scroll

### For DevOps
1. **Rate Limiting**: Implement to prevent abuse
2. **Monitoring**: Monitor SSE connection count
3. **Caching**: Cache doctor profile responses
4. **Compression**: Enable gzip for API responses

---

## 🧪 Testing Checklist

### Manual Testing
- [ ] Patient can initiate consultation
- [ ] Doctor receives consultation notification
- [ ] Messages send/receive correctly
- [ ] Chat history loads with pagination
- [ ] Typing indicator works
- [ ] Doctor can close consultation
- [ ] Report generates automatically
- [ ] SSE events stream in real-time
- [ ] Attachments upload correctly
- [ ] Error messages display properly

### Integration Testing
- [ ] Multiple consultations work simultaneously
- [ ] Message ordering is correct
- [ ] Timestamps are accurate
- [ ] Read receipts work
- [ ] Permissions are enforced

### Performance Testing
- [ ] Load test with 100+ concurrent users
- [ ] Message latency < 500ms
- [ ] SSE connection stability
- [ ] Database query optimization

---

## 📚 Additional Resources

### Files in `/docs` folder
1. `postman-chatbot-api-complete.collection.json` - Full Postman collection
2. `CHATBOT_API_DOCUMENTATION.md` - Complete technical documentation
3. `postman-chat-consultation.collection.json` - Original collection (legacy)
4. `SMTP_EMAIL_SETUP.md` - Email configuration

### Related Documentation
- `PATIENT_API_DOCUMENTATION.md` - Patient endpoints
- `DOCTOR_API_DOCUMENTATION.md` - Doctor endpoints
- `ADMIN_API_DOCUMENTATION.md` - Admin endpoints
- `APPLICATION_FLOW.md` - Complete application flow

---

## 🆘 Getting Help

### Need Help?
1. **Check Documentation**: Read `CHATBOT_API_DOCUMENTATION.md`
2. **Postman Examples**: Use pre-built requests in collection
3. **Check Status**: Review error response for specific details
4. **Email Support**: contact support@myskin.local

### Report Issues
1. Check existing GitHub issues
2. Include error message and endpoint used
3. Provide request/response body
4. Include environment (dev/staging/prod)

---

## 🎯 Next Steps

### For API Consumer
1. ✅ Import Postman collection
2. ✅ Test with demo credentials
3. ✅ Integrate into your application
4. ✅ Implement error handling
5. ✅ Setup auto-reconnect for SSE

### For Developer
1. ✅ Review code in `src/controllers/consultation.controller.js`
2. ✅ Check `src/services/consultation.service.js`
3. ✅ Review validation in `src/validators/consultation.validator.js`
4. ✅ Understand event system in `consultation-events.service.js`

---

**Last Updated**: 2026-06-11  
**Version**: v1.0  
**Status**: ✅ Production Ready
