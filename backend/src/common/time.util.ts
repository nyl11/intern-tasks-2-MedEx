import { DateTime } from 'luxon';

/**
 * Time and Timezone utilities for Bodhi Family Clinic (Asia/Kathmandu, UTC+05:45)
 * powered by Luxon with official IANA timezone support.
 */

export const CLINIC_TIMEZONE = 'Asia/Kathmandu';

/**
 * Converts any ISO string, JS Date, or Luxon DateTime into a DateTime in the Asia/Kathmandu zone.
 */
export function toKathmanduDateTime(dateInput: string | Date | DateTime): DateTime {
  if (dateInput instanceof DateTime) {
    return dateInput.setZone(CLINIC_TIMEZONE);
  }
  if (dateInput instanceof Date) {
    return DateTime.fromJSDate(dateInput, { zone: CLINIC_TIMEZONE });
  }
  return DateTime.fromISO(dateInput, { setZone: true }).setZone(CLINIC_TIMEZONE);
}

/**
 * Safely parses any date input into a native JS Date.
 */
export function parseDate(dateInput: string | Date): Date {
  if (dateInput instanceof Date) {
    return dateInput;
  }
  return new Date(dateInput);
}

/**
 * Returns the clinic's local calendar day in YYYY-MM-DD format using Asia/Kathmandu timezone.
 * "Every day" means the clinic's local day, starting at midnight in Kathmandu.
 */
export function getKathmanduDayString(dateInput: string | Date): string {
  const dt = toKathmanduDateTime(dateInput);
  return dt.toFormat('yyyy-MM-dd');
}

/**
 * Check if check-in is more than 15 minutes after appointment time.
 * "Exactly 15 minutes late is still on time."
 */
export function isMoreThan15MinutesLate(appointmentTime: string | Date, checkInTime: string | Date): boolean {
  const appt = toKathmanduDateTime(appointmentTime);
  const checkIn = toKathmanduDateTime(checkInTime);
  const diffMinutes = checkIn.diff(appt, 'minutes').minutes;
  return diffMinutes > 15;
}

/**
 * Check if an appointment is due at the given current time.
 * "Due appointments, meaning those whose appointment time is no later than now + 10 minutes."
 */
export function isAppointmentDue(appointmentTime: string | Date, currentTime: string | Date): boolean {
  const appt = toKathmanduDateTime(appointmentTime);
  const now = toKathmanduDateTime(currentTime);
  const diffMinutes = appt.diff(now, 'minutes').minutes;
  return diffMinutes <= 10;
}

/**
 * Format time to "HH:mm" in Kathmandu local time for logging and snapshot comparisons.
 */
export function formatKathmanduHHmm(dateInput: string | Date): string {
  const dt = toKathmanduDateTime(dateInput);
  return dt.toFormat('HH:mm');
}
