const bcrypt = require("bcryptjs");

const BCRYPT_ROUNDS = 12;
const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_MAX_LENGTH = 128;

const COMMON_PASSWORDS = new Set([
  "password",
  "password123",
  "password123!",
  "admin123",
  "admin123456",
  "qwerty123",
  "qwerty123!",
  "12345678",
  "123456789",
  "1234567890",
  "letmein123",
  "welcome123",
  "iloveyou123",
]);

const normalizeComparable = (value = "") => (
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
);

const getPasswordStrengthErrors = (password, context = {}) => {
  const errors = [];

  if (typeof password !== "string" || password.length === 0) {
    return ["Password wajib diisi"];
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password minimal ${PASSWORD_MIN_LENGTH} karakter`);
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push(`Password maksimal ${PASSWORD_MAX_LENGTH} karakter`);
  }

  if (/\s/.test(password)) {
    errors.push("Password tidak boleh mengandung spasi");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password harus mengandung huruf kecil");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password harus mengandung huruf besar");
  }

  if (!/\d/.test(password)) {
    errors.push("Password harus mengandung angka");
  }

  if (!/[^A-Za-z0-9\s]/.test(password)) {
    errors.push("Password harus mengandung simbol");
  }

  const comparablePassword = normalizeComparable(password);
  if (COMMON_PASSWORDS.has(comparablePassword)) {
    errors.push("Password terlalu umum dan mudah ditebak");
  }

  if (/(.)\1{3,}/.test(password)) {
    errors.push("Password tidak boleh mengandung karakter berulang berlebihan");
  }

  const userFields = [
    context.email,
    context.name,
    context.fullName,
    ...(context.userFields || []),
  ].filter(Boolean);

  for (const field of userFields) {
    const normalizedField = normalizeComparable(field);
    const fieldTokens = String(field)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map(normalizeComparable)
      .filter((token) => token.length >= 4);

    if (
      normalizedField.length >= 4 &&
      comparablePassword.includes(normalizedField)
    ) {
      errors.push("Password tidak boleh mengandung nama atau email user");
      break;
    }

    const emailLocalPart = String(field).split("@")[0];
    const normalizedLocalPart = normalizeComparable(emailLocalPart);
    if (normalizedLocalPart.length >= 4 && comparablePassword.includes(normalizedLocalPart)) {
      errors.push("Password tidak boleh mengandung nama atau email user");
      break;
    }

    if (fieldTokens.some((token) => comparablePassword.includes(token))) {
      errors.push("Password tidak boleh mengandung nama atau email user");
      break;
    }
  }

  return errors;
};

const assertStrongPassword = (password, context = {}) => {
  const errors = getPasswordStrengthErrors(password, context);

  if (errors.length > 0) {
    const error = new Error(errors.join("; "));
    error.status = 400;
    error.errors = { password: errors };
    throw error;
  }

  return password;
};

const hashPassword = async (password, context = {}) => {
  if (context.validate !== false) {
    assertStrongPassword(password, context);
  }

  return bcrypt.hash(password, BCRYPT_ROUNDS);
};

const verifyPassword = (plainPassword, hashedPassword) => bcrypt.compare(plainPassword, hashedPassword);

const generateSecureTemporaryPassword = () => {
  const crypto = require("crypto");
  return `Tmp-${crypto.randomBytes(18).toString("base64url")}!9aA`;
};

module.exports = {
  BCRYPT_ROUNDS,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  getPasswordStrengthErrors,
  assertStrongPassword,
  hashPassword,
  verifyPassword,
  generateSecureTemporaryPassword,
};
