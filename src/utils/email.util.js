const EMAIL_MESSAGES = {
  required: "Email wajib diisi",
  maxLength: "Email maksimal 254 karakter",
  oneAt: "Email harus memiliki tepat satu simbol @",
  emptyParts: "Username dan domain email tidak boleh kosong",
  tld: "Domain email wajib memiliki TLD",
  whitespace: "Email tidak boleh mengandung whitespace",
  dangerousChars: "Email mengandung karakter yang tidak diperbolehkan",
  invalidUsername: "Username email tidak valid",
  invalidDomain: "Domain email tidak valid",
  duplicate: "Email sudah terdaftar",
};

const createEmailError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const validateAndNormalizeEmail = (email, { required = true } = {}) => {
  if (email === undefined || email === null || String(email).trim().length === 0) {
    if (!required) return null;
    throw createEmailError(EMAIL_MESSAGES.required);
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  if (normalizedEmail.length > 254) {
    throw createEmailError(EMAIL_MESSAGES.maxLength);
  }

  if (/\s/.test(normalizedEmail)) {
    throw createEmailError(EMAIL_MESSAGES.whitespace);
  }

  if (/[<>]/.test(normalizedEmail)) {
    throw createEmailError(EMAIL_MESSAGES.dangerousChars);
  }

  const atMatches = normalizedEmail.match(/@/g) || [];
  if (atMatches.length !== 1) {
    throw createEmailError(EMAIL_MESSAGES.oneAt);
  }

  const [username, domain] = normalizedEmail.split("@");
  if (!username || !domain) {
    throw createEmailError(EMAIL_MESSAGES.emptyParts);
  }

  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(username)) {
    throw createEmailError(EMAIL_MESSAGES.invalidUsername);
  }

  if (!/^[a-z0-9.-]+$/.test(domain)) {
    throw createEmailError(EMAIL_MESSAGES.invalidDomain);
  }

  const domainLabels = domain.split(".");
  if (
    domainLabels.length < 2
    || domainLabels.some((label) => label.length === 0)
    || domainLabels[domainLabels.length - 1].length < 2
  ) {
    throw createEmailError(EMAIL_MESSAGES.tld);
  }

  return normalizedEmail;
};

const validateEmailForForm = (email, options = {}) => {
  try {
    validateAndNormalizeEmail(email, options);
    return null;
  } catch (error) {
    return error.message;
  }
};

const ensureEmailAvailable = async (prisma, email, excludeUserId = null) => {
  const existingEmail = await prisma.user.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
      ...(excludeUserId && {
        NOT: { id: excludeUserId },
      }),
    },
    select: { id: true },
  });

  if (existingEmail) {
    throw createEmailError(EMAIL_MESSAGES.duplicate, 409);
  }
};

module.exports = {
  EMAIL_MESSAGES,
  validateAndNormalizeEmail,
  validateEmailForForm,
  ensureEmailAvailable,
  createEmailError,
};
