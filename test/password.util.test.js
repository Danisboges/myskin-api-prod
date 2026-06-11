const test = require("node:test");
const assert = require("node:assert/strict");

const {
  BCRYPT_ROUNDS,
  getPasswordStrengthErrors,
  hashPassword,
  verifyPassword,
  generateSecureTemporaryPassword,
} = require("../src/utils/password.util");

test("password policy accepts strong passwords", () => {
  assert.deepEqual(
    getPasswordStrengthErrors("Str0ng!Pass2026", {
      email: "user@example.com",
      name: "User Example",
    }),
    []
  );
  assert.deepEqual(getPasswordStrengthErrors("Aa1!bb"), []);
});

test("password policy rejects weak and user-related passwords", () => {
  assert.deepEqual(getPasswordStrengthErrors("password123"), [
    "Password harus mengandung huruf besar",
    "Password harus mengandung simbol",
    "Password terlalu umum dan mudah ditebak",
  ]);

  assert.deepEqual(
    getPasswordStrengthErrors("Elena!Pass2026", {
      name: "Elena Aris",
    }),
    ["Password tidak boleh mengandung nama atau email user"]
  );
});

test("hashPassword uses bcrypt and verifies correctly", async () => {
  const hashed = await hashPassword("Str0ng!Pass2026");

  assert.match(hashed, /^\$2[aby]\$/);
  assert.ok(hashed.includes(`$${BCRYPT_ROUNDS}$`));
  assert.equal(await verifyPassword("Str0ng!Pass2026", hashed), true);
  assert.equal(await verifyPassword("Wrong!Pass2026", hashed), false);
});

test("generateSecureTemporaryPassword produces a strong password", () => {
  const password = generateSecureTemporaryPassword();

  assert.deepEqual(getPasswordStrengthErrors(password), []);
});
