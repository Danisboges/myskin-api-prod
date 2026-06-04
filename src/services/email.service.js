const nodemailer = require('nodemailer');

const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  return String(value).toLowerCase() === 'true';
};

const buildPasswordResetUrl = (resetToken) => {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
  return `${frontendUrl}/auth/reset-password?token=${encodeURIComponent(resetToken)}`;
};

const createTransporter = () => {
  if (!process.env.SMTP_HOST) {
    throw new Error('SMTP_HOST is not configured');
  }

  const auth = process.env.SMTP_USER || process.env.SMTP_PASS
    ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    }
    : undefined;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: parseBoolean(process.env.SMTP_SECURE, false),
    auth,
  });
};

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const buildPasswordResetEmail = ({ name, resetUrl, expiresAt }) => {
  const displayName = name || 'Pengguna MySkin';
  const safeDisplayName = escapeHtml(displayName);
  const safeResetUrl = escapeHtml(resetUrl);
  const expiryText = expiresAt
    ? new Date(expiresAt).toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta',
    }) + ' WIB'
    : '15 menit dari sekarang';
  const safeExpiryText = escapeHtml(expiryText);

  const text = [
    `Halo ${displayName},`,
    '',
    'Kami menerima permintaan untuk mengganti kata sandi akun MySkin Anda.',
    `Buka link berikut untuk mengganti kata sandi: ${resetUrl}`,
    '',
    'Link ini hanya berlaku selama 15 menit.',
    `Berlaku sampai: ${expiryText}`,
    '',
    'Jika Anda tidak meminta penggantian kata sandi, abaikan email ini. Akun Anda tetap aman selama link ini tidak dibuka.',
    '',
    'Salam,',
    'Tim MySkin',
  ].join('\n');

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>Reset your MySkin password</title>
      </head>
      <body style="margin:0;padding:0;background-color:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#172033;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f7fb;margin:0;padding:24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6edf5;">
                <tr>
                  <td style="background-color:#0f766e;padding:24px 28px;">
                    <div style="font-size:24px;line-height:30px;font-weight:700;color:#ffffff;">MySkin</div>
                    <div style="font-size:14px;line-height:20px;color:#d8fff7;margin-top:4px;">Permintaan ganti kata sandi</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px;">
                    <h1 style="margin:0 0 16px;font-size:22px;line-height:30px;color:#172033;">Ganti kata sandi Anda</h1>
                    <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#334155;">Halo ${safeDisplayName},</p>
                    <p style="margin:0 0 20px;font-size:15px;line-height:24px;color:#334155;">
                      Kami menerima permintaan untuk mengganti kata sandi akun MySkin Anda. Klik tombol di bawah untuk membuat kata sandi baru.
                    </p>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
                      <tr>
                        <td style="border-radius:8px;background-color:#0f766e;">
                          <a href="${safeResetUrl}" target="_blank" style="display:inline-block;padding:12px 20px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                            Ganti Kata Sandi
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0 0 12px;font-size:14px;line-height:22px;color:#475569;">
                      Link ini hanya berlaku selama <strong>15 menit</strong>.
                    </p>
                    <p style="margin:0 0 20px;font-size:14px;line-height:22px;color:#475569;">
                      Berlaku sampai: <strong>${safeExpiryText}</strong>
                    </p>
                    <p style="margin:0 0 8px;font-size:13px;line-height:20px;color:#64748b;">
                      Jika tombol tidak berfungsi, salin dan tempel link berikut ke browser:
                    </p>
                    <p style="margin:0 0 24px;font-size:13px;line-height:20px;word-break:break-all;color:#0f766e;">
                      <a href="${safeResetUrl}" target="_blank" style="color:#0f766e;text-decoration:underline;">${safeResetUrl}</a>
                    </p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f8fafc;border-radius:8px;">
                      <tr>
                        <td style="padding:14px 16px;font-size:13px;line-height:20px;color:#475569;">
                          Jika Anda tidak meminta penggantian kata sandi, abaikan email ini. Akun Anda tetap aman selama link ini tidak dibuka.
                        </td>
                      </tr>
                    </table>
                    <p style="margin:24px 0 0;font-size:14px;line-height:22px;color:#334155;">
                      Salam,<br>
                      Tim MySkin
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0;font-size:12px;line-height:18px;color:#94a3b8;">
                Email ini dikirim otomatis. Mohon jangan membalas email ini.
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  return { text, html };
};

const sendPasswordResetEmail = async ({ to, name, resetUrl, expiresAt }) => {
  const transporter = createTransporter();
  const { text, html } = buildPasswordResetEmail({ name, resetUrl, expiresAt });

  return transporter.sendMail({
    from: process.env.SMTP_FROM || '"MySkin" <no-reply@myskin.local>',
    to,
    subject: 'Reset your MySkin password',
    text,
    html,
  });
};

const buildClinicalSummaryEmail = ({
  patientName,
  doctorName,
  scanId,
  caseDisposition,
  finalClinicalNotes,
  diagnosis,
  recommendation,
}) => {
  const displayName = patientName || 'Pengguna MySkin';
  const safeDisplayName = escapeHtml(displayName);
  const safeDoctorName = escapeHtml(doctorName || 'Dokter MySkin');
  const safeScanId = escapeHtml(scanId || '-');
  const safeCaseDisposition = escapeHtml(caseDisposition || '-');
  const safeFinalClinicalNotes = escapeHtml(finalClinicalNotes || '-');
  const safeDiagnosis = escapeHtml(diagnosis || '-');
  const safeRecommendation = escapeHtml(recommendation || '-');

  const text = [
    `Halo ${displayName},`,
    '',
    'Konsultasi Anda di MySkin telah selesai. Berikut ringkasan klinis dari dokter:',
    `Dokter: ${doctorName || 'Dokter MySkin'}`,
    `Scan ID: ${scanId || '-'}`,
    `Disposition: ${caseDisposition || '-'}`,
    `Diagnosis: ${diagnosis || '-'}`,
    `Rekomendasi: ${recommendation || '-'}`,
    '',
    'Catatan Klinis:',
    finalClinicalNotes || '-',
    '',
    'Silakan buka aplikasi MySkin untuk melihat detail report lengkap.',
    '',
    'Salam,',
    'Tim MySkin',
  ].join('\n');

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>Clinical consultation summary</title>
      </head>
      <body style="margin:0;padding:0;background-color:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#172033;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f7fb;margin:0;padding:24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6edf5;">
                <tr>
                  <td style="background-color:#1e3a8a;padding:24px 28px;">
                    <div style="font-size:24px;line-height:30px;font-weight:700;color:#ffffff;">MySkin</div>
                    <div style="font-size:14px;line-height:20px;color:#dbeafe;margin-top:4px;">Ringkasan konsultasi klinis</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px;">
                    <h1 style="margin:0 0 16px;font-size:22px;line-height:30px;color:#172033;">Konsultasi selesai</h1>
                    <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#334155;">Halo ${safeDisplayName},</p>
                    <p style="margin:0 0 20px;font-size:15px;line-height:24px;color:#334155;">
                      Konsultasi Anda telah selesai. Berikut ringkasan klinis dari dokter.
                    </p>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;margin:0 0 20px;">
                      <tr><td style="padding:8px 0;color:#64748b;">Dokter</td><td style="padding:8px 0;color:#172033;font-weight:700;">${safeDoctorName}</td></tr>
                      <tr><td style="padding:8px 0;color:#64748b;">Scan ID</td><td style="padding:8px 0;color:#172033;font-weight:700;">${safeScanId}</td></tr>
                      <tr><td style="padding:8px 0;color:#64748b;">Disposition</td><td style="padding:8px 0;color:#172033;font-weight:700;">${safeCaseDisposition}</td></tr>
                      <tr><td style="padding:8px 0;color:#64748b;">Diagnosis</td><td style="padding:8px 0;color:#172033;font-weight:700;">${safeDiagnosis}</td></tr>
                    </table>
                    <div style="background-color:#f8fafc;border-radius:8px;padding:16px;margin:0 0 18px;">
                      <div style="font-size:13px;line-height:20px;color:#64748b;margin-bottom:6px;">Catatan klinis</div>
                      <div style="font-size:15px;line-height:24px;color:#172033;">${safeFinalClinicalNotes}</div>
                    </div>
                    <div style="background-color:#f8fafc;border-radius:8px;padding:16px;">
                      <div style="font-size:13px;line-height:20px;color:#64748b;margin-bottom:6px;">Rekomendasi</div>
                      <div style="font-size:15px;line-height:24px;color:#172033;">${safeRecommendation}</div>
                    </div>
                    <p style="margin:24px 0 0;font-size:14px;line-height:22px;color:#334155;">
                      Silakan buka aplikasi MySkin untuk melihat detail report lengkap.
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0;font-size:12px;line-height:18px;color:#94a3b8;">
                Email ini dikirim otomatis. Mohon jangan membalas email ini.
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  return { text, html };
};

const sendClinicalSummaryEmail = async ({ to, ...summary }) => {
  const transporter = createTransporter();
  const { text, html } = buildClinicalSummaryEmail(summary);

  return transporter.sendMail({
    from: process.env.SMTP_FROM || '"MySkin" <no-reply@myskin.local>',
    to,
    subject: 'MySkin clinical consultation summary',
    text,
    html,
  });
};

const buildDoctorNotificationEmail = ({ doctorName, title, message, type }) => {
  const displayName = doctorName || 'Doctor';
  const safeDisplayName = escapeHtml(displayName);
  const safeTitle = escapeHtml(title || 'MySkin notification');
  const safeMessage = escapeHtml(message || '');
  const safeType = escapeHtml(type || 'notification');

  const text = [
    `Hello ${displayName},`,
    '',
    title || 'MySkin notification',
    message || '',
    '',
    `Type: ${type || 'notification'}`,
    '',
    'Please open MySkin to review the details.',
    '',
    'Regards,',
    'MySkin Team',
  ].join('\n');

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>${safeTitle}</title>
      </head>
      <body style="margin:0;padding:0;background-color:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#172033;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f7fb;margin:0;padding:24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6edf5;">
                <tr>
                  <td style="background-color:#1e3a8a;padding:24px 28px;">
                    <div style="font-size:24px;line-height:30px;font-weight:700;color:#ffffff;">MySkin</div>
                    <div style="font-size:14px;line-height:20px;color:#dbeafe;margin-top:4px;">Doctor notification</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px;">
                    <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#334155;">Hello ${safeDisplayName},</p>
                    <h1 style="margin:0 0 12px;font-size:22px;line-height:30px;color:#172033;">${safeTitle}</h1>
                    <p style="margin:0 0 20px;font-size:15px;line-height:24px;color:#334155;">${safeMessage}</p>
                    <div style="background-color:#f8fafc;border-radius:8px;padding:14px 16px;font-size:13px;line-height:20px;color:#475569;">
                      Notification type: <strong>${safeType}</strong>
                    </div>
                    <p style="margin:24px 0 0;font-size:14px;line-height:22px;color:#334155;">
                      Please open MySkin to review the details.
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin:16px 0 0;font-size:12px;line-height:18px;color:#94a3b8;">
                This is an automated email. Please do not reply.
              </p>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  return { text, html };
};

const sendDoctorNotificationEmail = async ({ to, subject, ...notification }) => {
  const transporter = createTransporter();
  const { text, html } = buildDoctorNotificationEmail(notification);

  return transporter.sendMail({
    from: process.env.SMTP_FROM || '"MySkin" <no-reply@myskin.local>',
    to,
    subject: subject || notification.title || 'MySkin doctor notification',
    text,
    html,
  });
};

module.exports = {
  buildPasswordResetUrl,
  sendPasswordResetEmail,
  sendClinicalSummaryEmail,
  sendDoctorNotificationEmail,
};
