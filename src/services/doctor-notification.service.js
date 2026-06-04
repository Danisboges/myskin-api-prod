const prisma = require('../config/prisma');
const emailService = require('./email.service');

const VERIFICATION_ALERT_TYPES = new Set([
  'case_request',
  'scan_complete',
  'verification_alert'
]);

const getDoctorWithSettings = async (doctorId) => prisma.doctorProfile.findUnique({
  where: { id: doctorId },
  include: {
    user: {
      select: {
        id: true,
        name: true,
        email: true
      }
    },
    settings: true
  }
});

const getSettingValue = (settings, key, fallback = true) => (
  settings && settings[key] !== undefined && settings[key] !== null
    ? settings[key]
    : fallback
);

const createDoctorNotification = async ({
  doctorId,
  title,
  message,
  type = 'case_request',
  emailSubject,
  metadata = {}
}) => {
  try {
    const doctor = await getDoctorWithSettings(doctorId);
    if (!doctor || !doctor.user) {
      return {
        inAppNotificationCreated: false,
        emailNotificationQueued: false
      };
    }

    const verificationAlertsEnabled = getSettingValue(doctor.settings, 'verificationAlerts', true);
    const emailNotificationsEnabled = getSettingValue(doctor.settings, 'emailNotifications', true);
    const isVerificationAlert = VERIFICATION_ALERT_TYPES.has(type);
    const shouldCreateInApp = !isVerificationAlert || verificationAlertsEnabled;
    let inAppNotificationCreated = false;
    let emailNotificationQueued = false;

    if (shouldCreateInApp) {
      await prisma.notification.create({
        data: {
          doctorId,
          title,
          message,
          type,
          isRead: false
        }
      });
      inAppNotificationCreated = true;
    }

    if (emailNotificationsEnabled && doctor.user.email) {
      emailNotificationQueued = true;
      try {
        await emailService.sendDoctorNotificationEmail({
          to: doctor.user.email,
          doctorName: doctor.user.name,
          title,
          message,
          type,
          subject: emailSubject || title,
          metadata
        });
      } catch (error) {
        console.error('Failed to send doctor notification email:', error.message);
      }
    }

    return {
      inAppNotificationCreated,
      emailNotificationQueued
    };
  } catch (error) {
    console.error('Error creating doctor notification:', error.message);
    return {
      inAppNotificationCreated: false,
      emailNotificationQueued: false
    };
  }
};

module.exports = {
  createDoctorNotification
};
