/**
 * Serializes a local calendar day without locale-dependent formatting.
 *
 * Calendar dates represent civil days, so this intentionally reads local date
 * parts instead of converting the value to UTC.
 */
export function getCalendarDayKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}
