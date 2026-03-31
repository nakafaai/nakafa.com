import { format, formatISO, isValid, parse } from "date-fns";

export const CONTENT_DATE_FORMAT = "MM/dd/yyyy";
const CONTENT_DATE_REFERENCE = new Date(0);

/**
 * Parses a repository content date using the canonical `MM/DD/YYYY` format.
 *
 * The content corpus stores metadata dates as strings, so callers should use
 * this helper instead of relying on `new Date(string)` heuristics.
 *
 * @param dateString - Raw metadata date string from MDX content
 * @returns Parsed date when the string strictly matches `MM/DD/YYYY`, else null
 */
export function parseContentDate(dateString: string): Date | null {
  const parsedDate = parse(
    dateString,
    CONTENT_DATE_FORMAT,
    CONTENT_DATE_REFERENCE
  );

  if (!isValid(parsedDate)) {
    return null;
  }

  return format(parsedDate, CONTENT_DATE_FORMAT) === dateString
    ? parsedDate
    : null;
}

/**
 * Checks whether a metadata date string matches the canonical repository date
 * format.
 *
 * @param dateString - Raw metadata date string from MDX content
 * @returns True when the date is a valid `MM/DD/YYYY` value
 */
export function isContentDateString(dateString: string): boolean {
  return parseContentDate(dateString) !== null;
}

/**
 * Formats a repository content date as an ISO-8601 timestamp.
 *
 * @param dateString - Raw metadata date string from MDX content
 * @returns ISO string when parsing succeeds, else null
 */
export function formatContentDateISO(dateString: string): string | null {
  const parsedDate = parseContentDate(dateString);

  return parsedDate ? formatISO(parsedDate) : null;
}
