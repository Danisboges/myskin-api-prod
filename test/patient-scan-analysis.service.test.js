const test = require("node:test");
const assert = require("node:assert/strict");

const prisma = require("../src/config/prisma");
const patientService = require("../src/services/patient.service");

const created = {
  userIds: [],
  scanIds: [],
};

const stamp = () => `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;

const createPatientScan = async ({ complaint }) => {
  const token = stamp();
  const user = await prisma.user.create({
    data: {
      name: `Patient Scan ${token}`,
      email: `patient.scan.${token}@example.com`,
      password: "hashed-password",
      role: "patient",
      gender: "male",
      status: "active",
      patientProfile: {
        create: {},
      },
    },
    include: {
      patientProfile: true,
    },
  });
  created.userIds.push(user.id);

  const scan = await prisma.scan.create({
    data: {
      patientId: user.patientProfile.id,
      imageUrl: "/uploads/missing-test-image.jpg",
      complaint,
      bodySite: "arm",
      isAnalyzed: false,
    },
  });
  created.scanIds.push(scan.id);

  return { user, scan };
};

test.after(async () => {
  if (created.scanIds.length > 0) {
    await prisma.scan.deleteMany({
      where: { id: { in: created.scanIds } },
    });
  }

  if (created.userIds.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: created.userIds } },
    });
  }

  await prisma.$disconnect();
});

test("analyzeScan rejects short complaints before calling AI or reading image files", async () => {
  const { user, scan } = await createPatientScan({
    complaint: "bad     mole",
  });

  await assert.rejects(
    patientService.analyzeScan(user.id, scan.scanId),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.message, "Complaint must be at least 10 characters");
      return true;
    }
  );
});
