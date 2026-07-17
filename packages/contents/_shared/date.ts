import { Option, Schema } from "effect";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Returns true when a string is a real ISO `YYYY-MM-DD` date-only value. */
export function isDateOnlyString(dateString: string): boolean {
  const match = DATE_ONLY_PATTERN.exec(dateString);

  if (!match) {
    return false;
  }

  const year = Number.parseInt(dateString.slice(0, 4), 10);
  const month = Number.parseInt(dateString.slice(5, 7), 10);
  const day = Number.parseInt(dateString.slice(8, 10), 10);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Canonical date-only schema for source-authored content and program registry data.
 *
 * Store date-only metadata as ISO `YYYY-MM-DD`; localize user-facing display at
 * render boundaries instead of encoding locale into the source string.
 */
export const DateOnlySchema = Schema.String.pipe(
  Schema.filter(isDateOnlyString, {
    identifier: "DateOnly",
    description: "ISO date-only value in YYYY-MM-DD format.",
    message: () => "Invalid date. Expected YYYY-MM-DD.",
  }),
  Schema.brand("@Nakafa/DateOnly")
);

/** Canonical source-authored date-only string. */
export type DateOnly = Schema.Schema.Type<typeof DateOnlySchema>;

/**
 * Parses a repository content date using the canonical ISO `YYYY-MM-DD` format.
 *
 * The content corpus stores metadata dates as strings, so callers should use
 * this helper instead of relying on `new Date(string)` heuristics.
 *
 * @param dateString - Raw metadata date string from MDX content
 * @returns Parsed UTC date when the string strictly matches `YYYY-MM-DD`
 */
export function parseContentDate(dateString: string) {
  if (!isDateOnlyString(dateString)) {
    return Option.none<Date>();
  }

  const year = Number.parseInt(dateString.slice(0, 4), 10);
  const month = Number.parseInt(dateString.slice(5, 7), 10);
  const day = Number.parseInt(dateString.slice(8, 10), 10);

  return Option.some(new Date(Date.UTC(year, month - 1, day)));
}

/**
 * Formats a repository content date as an ISO-8601 UTC timestamp.
 *
 * @param dateString - Raw metadata date string from MDX content
 * @returns ISO string when parsing succeeds
 */
export function formatContentDateISO(dateString: string) {
  return parseContentDate(dateString).pipe(
    Option.map((date) => date.toISOString())
  );
}
