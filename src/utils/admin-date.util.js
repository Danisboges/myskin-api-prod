const SUPPORTED_ADMIN_TIMEZONES = new Set([
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
  "UTC",
]);

const formatDateForAdmin = (date, timezone = "Asia/Jakarta") => {
  if (!date) return null;

  const safeTimezone = SUPPORTED_ADMIN_TIMEZONES.has(timezone) ? timezone : "Asia/Jakarta";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: safeTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(date));

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second} ${safeTimezone}`;
};

module.exports = {
  formatDateForAdmin,
};
