const test = require("node:test");
const assert = require("node:assert/strict");

process.env.ADMIN_NOTIFICATION_TEST_DISABLE = "true";

const prisma = require("../src/config/prisma");
const clinicRequestService = require("../src/services/clinic-request.service");
const {
  validateCreateClinicRequest,
  validateClinicRequestListQuery,
  validateReviewClinicRequest,
} = require("../src/validators/clinic-request.validator");

const createdClinicRequestIds = [];
const createdClinicIds = [];

test.after(async () => {
  if (createdClinicRequestIds.length > 0) {
    await prisma.clinicRequest.deleteMany({
      where: { requestId: { in: createdClinicRequestIds } },
    });
  }

  if (createdClinicIds.length > 0) {
    await prisma.clinic.deleteMany({
      where: { clinicId: { in: createdClinicIds } },
    });
  }

  await prisma.$disconnect();
});

test("clinic request service creates, lists, and approves a request", async () => {
  const stamp = `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const createdRequest = await clinicRequestService.createClinicRequest({
    clinicName: `Requested Clinic ${stamp}`,
    address: "456 Request Street",
    phone: "+628123456789",
    email: `requested.clinic.${stamp}@example.com`,
    requesterName: "Dr Requester",
    requesterEmail: `requester.${stamp}@example.com`,
    requesterPhone: "+628987654321",
    message: "Please add our clinic.",
  });

  createdClinicRequestIds.push(createdRequest.requestId);

  assert.equal(createdRequest.status, "pending");
  assert.equal(createdRequest.clinicId, null);

  const listResult = await clinicRequestService.getClinicRequests({
    search: stamp,
    status: "pending",
    page: 1,
    limit: 5,
  });

  assert.equal(listResult.meta.total, 1);
  assert.equal(listResult.data[0].requestId, createdRequest.requestId);

  const approvedRequest = await clinicRequestService.reviewClinicRequest(createdRequest.requestId, {
    status: "approved",
    reviewNote: "Approved for registration.",
    adminId: "admin-id",
    adminName: "Admin User",
  });

  createdClinicIds.push(approvedRequest.clinicId);

  assert.equal(approvedRequest.status, "approved");
  assert.equal(approvedRequest.reviewNote, "Approved for registration.");
  assert.equal(approvedRequest.reviewedByAdminId, "admin-id");
  assert.equal(approvedRequest.clinic.name, `Requested Clinic ${stamp}`);
});

test("clinic request service rejects duplicates while pending", async () => {
  const stamp = `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const request = await clinicRequestService.createClinicRequest({
    clinicName: `Duplicate Clinic ${stamp}`,
    requesterName: "Duplicate Requester",
    requesterEmail: `duplicate.${stamp}@example.com`,
  });

  createdClinicRequestIds.push(request.requestId);

  await assert.rejects(
    clinicRequestService.createClinicRequest({
      clinicName: `Duplicate Clinic ${stamp}`,
      requesterName: "Other Requester",
      requesterEmail: `other.${stamp}@example.com`,
    }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.message, "Clinic request dengan nama clinic tersebut masih menunggu review");
      return true;
    }
  );
});

test("clinic request service rejects review of a processed request", async () => {
  const stamp = `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const request = await clinicRequestService.createClinicRequest({
    clinicName: `Rejected Clinic ${stamp}`,
    requesterName: "Rejected Requester",
    requesterEmail: `rejected.${stamp}@example.com`,
  });

  createdClinicRequestIds.push(request.requestId);

  const rejectedRequest = await clinicRequestService.reviewClinicRequest(request.requestId, {
    status: "rejected",
    reviewNote: "Clinic data belum lengkap.",
    adminId: "admin-id",
    adminName: "Admin User",
  });

  assert.equal(rejectedRequest.status, "rejected");

  await assert.rejects(
    clinicRequestService.reviewClinicRequest(request.requestId, {
      status: "approved",
      adminId: "admin-id",
      adminName: "Admin User",
    }),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.message, "Clinic request sudah diproses");
      return true;
    }
  );
});

test("clinic request validators reject invalid payloads", () => {
  assert.deepEqual(validateCreateClinicRequest({}), {
    clinicName: "clinicName wajib diisi",
    requesterName: "requesterName wajib diisi",
    requesterEmail: "requesterEmail harus berupa email yang valid",
  });

  assert.deepEqual(validateClinicRequestListQuery({ status: "unknown", page: "0" }), {
    page: "Page must be a positive number",
    status: "status harus bernilai all, pending, approved, atau rejected",
  });

  assert.deepEqual(validateReviewClinicRequest({ status: "cancelled" }), {
    errors: {
      status: "status harus bernilai approved atau rejected",
    },
    status: "cancelled",
  });

  assert.deepEqual(validateReviewClinicRequest({ action: "reject" }), {
    errors: {
      reviewNote: "reviewNote wajib diisi saat menolak clinic request",
    },
    status: "rejected",
  });
});
