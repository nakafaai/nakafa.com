import { describe, expect, it } from "@effect/vitest";
import {
  formatLongMonthYear,
  formatShortMonthYear,
} from "@repo/design-system/lib/charts/month";

/** Every date key of the electability dataset, with the labels it must produce. */
const ELECTABILITY_MONTHS = [
  { date: "2021-01-01", long: "January 2021", short: "Jan 2021" },
  { date: "2022-05-01", long: "May 2022", short: "May 2022" },
  { date: "2022-06-01", long: "June 2022", short: "Jun 2022" },
  { date: "2022-07-01", long: "July 2022", short: "Jul 2022" },
  { date: "2022-10-01", long: "October 2022", short: "Oct 2022" },
  { date: "2023-01-01", long: "January 2023", short: "Jan 2023" },
  { date: "2023-02-01", long: "February 2023", short: "Feb 2023" },
  { date: "2023-04-01", long: "April 2023", short: "Apr 2023" },
  { date: "2023-07-01", long: "July 2023", short: "Jul 2023" },
  { date: "2023-09-01", long: "September 2023", short: "Sep 2023" },
  { date: "2023-10-01", long: "October 2023", short: "Oct 2023" },
  { date: "2023-12-01", long: "December 2023", short: "Dec 2023" },
  { date: "2024-01-01", long: "January 2024", short: "Jan 2024" },
  { date: "2024-02-01", long: "February 2024", short: "Feb 2024" },
] as const;

describe("chart month labels", () => {
  it.each(ELECTABILITY_MONTHS)(
    "labels $date as $short and $long",
    ({ date, long, short }) => {
      expect(formatShortMonthYear(date)).toBe(short);
      expect(formatLongMonthYear(date)).toBe(long);
    }
  );
});
