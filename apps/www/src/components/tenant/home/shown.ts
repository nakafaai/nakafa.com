import { Schema } from "effect";

/** The facts that decide which cells of a staff home show: what the viewer may do, and the counts of its lists. */
const StaffFacts = Schema.Struct({
  canCreate: Schema.Boolean,
  canWatch: Schema.Boolean,
  closed: Schema.Int,
  drafts: Schema.Int,
  live: Schema.Int,
  next: Schema.Int,
  setupShown: Schema.Boolean,
});

/** The facts of a staff home, as the home reads them. */
type StaffFacts = typeof StaffFacts.Type;

/** The cells of a staff home: the four numbers of its strip, and the cells below them. */
const StaffCell = Schema.Literals([
  "count-drafts",
  "count-live",
  "count-next",
  "count-waiting",
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
 * Which cells a staff home shows. A cell with nothing to show is left out: the schedule and the live rooms need a
 * room, the results need a closed sitting, and the quiet state takes the place of the schedule and the live rooms
 * while a viewer who may watch rooms has none running and none soon. The strip's numbers of rooms, results and
 * releases need the right to watch, and its drafts need the right to create an exam, so a viewer sees no number of
 * what the viewer may not act on.
 */
export const staffShown = (
  facts: StaffFacts
): Readonly<Record<StaffCell, boolean>> => ({
  "count-drafts": facts.canCreate,
  "count-live": facts.canWatch,
  "count-next": facts.canWatch,
  "count-waiting": facts.canWatch,
  drafts: facts.canCreate && facts.drafts > 0,
  live: facts.live > 0,
  quiet: facts.canWatch && facts.live === 0 && facts.next === 0,
  results: facts.closed > 0,
  schedule: facts.next > 0,
  setup: facts.setupShown,
});

/** The facts that decide which cells of a student's home show. */
const StudentFacts = Schema.Struct({
  finished: Schema.Int,
  hasNow: Schema.Boolean,
  upcoming: Schema.Int,
});

/** The facts of a student's home, as the home reads them. */
type StudentFacts = typeof StudentFacts.Type;

/**
 * Which cells a student's home shows. The Now cell shows the sitting that is open or next, the schedule shows once a
 * sitting is still to come or open, the results show once a sitting closed, and the quiet state takes the place of
 * every cell for a student with no sitting and no result.
 */
export const studentShown = (facts: StudentFacts) => ({
  now: facts.hasNow,
  quiet: facts.upcoming === 0 && facts.finished === 0,
  results: facts.finished > 0,
  schedule: facts.upcoming > 0,
});
