import { Schema } from "effect";

/** The facts that decide which cells of a staff home show: what the viewer may do, and the counts of its lists. */
const StaffFacts = Schema.Struct({
  canCreate: Schema.Boolean,
  canWatch: Schema.Boolean,
  classes: Schema.Int,
  closed: Schema.Int,
  drafts: Schema.Int,
  live: Schema.Int,
  next: Schema.Int,
  setupShown: Schema.Boolean,
});

/** The facts of a staff home, as the home reads them. */
type StaffFacts = typeof StaffFacts.Type;

/** The cells of a staff home. */
const StaffCell = Schema.Literals([
  "classes",
  "drafts",
  "live",
  "quiet",
  "results",
  "schedule",
  "setup",
]);

/** One cell of a staff home. */
type StaffCell = typeof StaffCell.Type;

/**
 * Which cells a staff home shows. A cell with nothing to show is left out: the classes need a class the viewer teaches
 * or attends, the schedule and the live rooms need a room, the results need a closed sitting, the drafts need the
 * right to create an exam, and the quiet state takes the place of the schedule and the live rooms while a viewer who
 * may watch rooms has none running and none soon.
 */
export const staffShown = (
  facts: StaffFacts
): Readonly<Record<StaffCell, boolean>> => ({
  classes: facts.classes > 0,
  drafts: facts.canCreate && facts.drafts > 0,
  live: facts.live > 0,
  quiet: facts.canWatch && facts.live === 0 && facts.next === 0,
  results: facts.closed > 0,
  schedule: facts.next > 0,
  setup: facts.setupShown,
});

/** The facts that decide which cells of a student's home show. */
const StudentFacts = Schema.Struct({
  classes: Schema.Int,
  finished: Schema.Int,
  hasNow: Schema.Boolean,
  upcoming: Schema.Int,
});

/** The facts of a student's home, as the home reads them. */
type StudentFacts = typeof StudentFacts.Type;

/**
 * Which cells a student's home shows. The classes show once the student attends one, the Now cell shows the sitting
 * that is open or next, the schedule shows once a sitting is still to come or open, the results show once a sitting
 * closed, and the quiet state takes the place of the sitting cells for a student with no sitting and no result.
 */
export const studentShown = (facts: StudentFacts) => ({
  classes: facts.classes > 0,
  now: facts.hasNow,
  quiet: facts.upcoming === 0 && facts.finished === 0,
  results: facts.finished > 0,
  schedule: facts.upcoming > 0,
});
