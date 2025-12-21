import { addDays, format, getHours, getMinutes, isToday, set } from "date-fns";
import type { Locale } from "next-intl";
import { getLocale } from "@/lib/utils/date";

/** Format a timestamp to a localized date-time string (e.g., "Dec 21, 2025, 08:00"). */
export function formatScheduledAt(timestamp: number, locale: Locale) {
  return format(timestamp, "PP, HH:mm", { locale: getLocale(locale) });
}

/** Get time string in HH:mm format from timestamp. */
export function getTimeString(timestamp: number) {
  return format(timestamp, "HH:mm");
}

/** Update the time portion of a timestamp. Returns original if result would be in the past. */
export function updateTime(timestamp: number, timeString: string) {
  const [hours, minutes] = timeString.split(":").map(Number);
  const newTimestamp = set(timestamp, { hours, minutes, seconds: 0 }).getTime();
  return newTimestamp <= Date.now() ? timestamp : newTimestamp;
}

/** Update the date portion of a timestamp, preserving time or defaulting to 8:00. */
export function updateDate(timestamp: number | undefined, newDate: Date) {
  const hours = timestamp ? getHours(timestamp) : 8;
  const minutes = timestamp ? getMinutes(timestamp) : 0;
  const newTimestamp = set(newDate, { hours, minutes, seconds: 0 }).getTime();
  if (newTimestamp <= Date.now()) {
    return set(newDate, {
      hours: getHours(new Date()) + 1,
      minutes: 0,
      seconds: 0,
    }).getTime();
  }
  return newTimestamp;
}

/** Get default scheduled time (tomorrow at 8:00). */
export function getDefaultScheduledAt() {
  return set(addDays(new Date(), 1), {
    hours: 8,
    minutes: 0,
    seconds: 0,
  }).getTime();
}

/** Get minimum time for time input (current time if today). */
export function getMinTime(timestamp: number | undefined) {
  if (timestamp && isToday(timestamp)) {
    return format(new Date(), "HH:mm");
  }
}
