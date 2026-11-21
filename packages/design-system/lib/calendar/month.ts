/** The month a day key falls in, written `YYYY-MM`, which sorts as the months do. */
const monthOf = (day: string) => day.slice(0, 7);

/**
 * The month a calendar's caption turns to, written `YYYY-MM` from a year and a month counted from 1, kept within the
 * calendar's bounds: a month before its first day gives that day's month, and one after its last day gives the last
 * day's. A year that would show a month the calendar does not offer shows the nearest month it does.
 */
export function boundedMonth(
  year: number,
  month: number,
  bounds: {
    readonly max?: string | undefined;
    readonly min?: string | undefined;
  }
) {
  const chosen = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;

  if (bounds.min !== undefined && chosen < monthOf(bounds.min)) {
    return monthOf(bounds.min);
  }
  if (bounds.max !== undefined && chosen > monthOf(bounds.max)) {
    return monthOf(bounds.max);
  }
  return chosen;
}
