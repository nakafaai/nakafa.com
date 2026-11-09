import type { Docs } from "@repo/backend/confect/_generated/docs";
import { Array as Arr, DateTime } from "effect";

/** The days in a row of try-outs that earn the Streak badge and its fountain (ADR 0047, D19). */
export const STREAK_DAYS = 7;

/** A day as an ISO date, read at midnight UTC so no zone moves it. */
function dateOf(day: string) {
  return DateTime.makeUnsafe(`${day}T00:00:00Z`);
}

/** The ISO date one day before another. */
export function dayBefore(day: string) {
  return DateTime.formatIsoDateUtc(DateTime.subtract(dateOf(day), { days: 1 }));
}

/** The seven ISO dates of the week a day falls in, Monday first. */
export function weekOf(day: string) {
  const date = dateOf(day);
  const fromMonday = (DateTime.getPartUtc(date, "weekDay") + 6) % 7;
  const monday = DateTime.subtract(date, { days: fromMonday });
  return Arr.makeBy(7, (index) =>
    DateTime.formatIsoDateUtc(DateTime.add(monday, { days: index }))
  );
}

/**
 * The days in a row the learner has learned, after a grant on `day`: the run
 * goes on from the day before, stays on a day already counted, and starts
 * again at one after a missed day.
 */
export function streakAfter(
  learned: string | undefined,
  streak: number,
  day: string
) {
  if (learned === day) {
    return Math.max(1, streak);
  }
  return learned === dayBefore(day) ? streak + 1 : 1;
}

/** The run as the learner sees it today: still alive when they learned today or yesterday, gone otherwise. */
export function streakOn(
  learned: string | undefined,
  streak: number,
  today: string
) {
  return learned === today || learned === dayBefore(today) ? streak : 0;
}

/** What one day of the week holds: its lessons, try-out sections and finished sets, and the Stars they gave. */
export function summaryOf(
  day: string,
  grants: readonly Pick<Docs["islandAwards"], "kind" | "stars">[]
) {
  return {
    day,
    lessons: Arr.countBy(grants, (grant) => grant.kind === "lesson"),
    sections: Arr.countBy(grants, (grant) => grant.kind === "section"),
    sets: Arr.countBy(grants, (grant) => grant.kind === "set"),
    stars: Arr.reduce(grants, 0, (total, grant) => total + grant.stars),
  };
}
