const test = require("node:test");
const assert = require("node:assert/strict");

const {
  EMAIL_MESSAGES,
  validateAndNormalizeEmail,
  validateEmailForForm,
} = require("../src/utils/email.util");

test("validateAndNormalizeEmail trims, lowercases, and accepts dot/plus usernames", () => {
  assert.equal(
    validateAndNormalizeEmail("  Nama.Depan+Testing@Website.COM  "),
    "nama.depan+testing@website.com"
  );
});

test("validateAndNormalizeEmail rejects invalid email shapes", () => {
  const cases = [
    [undefined, EMAIL_MESSAGES.required],
    ["a".repeat(245) + "@website.com", EMAIL_MESSAGES.maxLength],
    ["nama@@website.com", EMAIL_MESSAGES.oneAt],
    ["@website.com", EMAIL_MESSAGES.emptyParts],
    ["nama@", EMAIL_MESSAGES.emptyParts],
    ["nama@website", EMAIL_MESSAGES.tld],
    ["nama @website.com", EMAIL_MESSAGES.whitespace],
    ["na ma@website.com", EMAIL_MESSAGES.whitespace],
    ["nama<test>@website.com", EMAIL_MESSAGES.dangerousChars],
  ];

  for (const [email, message] of cases) {
    assert.throws(
      () => validateAndNormalizeEmail(email),
      (error) => {
        assert.equal(error.status, 400);
        assert.equal(error.message, message);
        return true;
      }
    );
  }
});

test("validateEmailForForm returns null for optional empty email", () => {
  assert.equal(validateEmailForForm(undefined, { required: false }), null);
});
