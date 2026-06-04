# SMTP Email Setup

Forgot Password uses SMTP through `nodemailer` to send reset links.

## Required environment variables

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM="MySkin <no-reply@myskin.local>"
FRONTEND_URL=http://localhost:5173
```

`FRONTEND_URL` is used to build reset links in this format:

```txt
${FRONTEND_URL}/auth/reset-password?token=${resetToken}
```

Only the raw reset token is sent in the email URL. The database stores the hashed token in `passwordResetToken`.

## Gmail app password example

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=email@gmail.com
SMTP_PASS=app_password
SMTP_FROM="MySkin <email@gmail.com>"
FRONTEND_URL=http://localhost:5173
```

For Gmail, use an app password, not your regular Google account password.
