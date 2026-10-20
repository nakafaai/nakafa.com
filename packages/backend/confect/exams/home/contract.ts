import { ExamSummary } from "@repo/backend/confect/exams/exam";
import { SittingView } from "@repo/backend/confect/exams/sittings/contract";
import { Schema } from "effect";

/**
 * The wire contract of the school home's exam read. A spec imports it, so this module holds
 * declarations only: no database read and no write.
 */

/**
 * One closed sitting that the school home lists for its results: the sitting, whether its results are
 * released, and whether the viewer may still release them. A released sitting offers no release, so the
 * results authority decides the action and the release time decides whether it is still open.
 */
export const ClosedView = Schema.Struct({
  ...SittingView.fields,
  canRelease: Schema.Boolean,
  resultsReleased: Schema.Boolean,
});

/**
 * What the school home shows a viewer about exams: the viewer's own drafts that the viewer may
 * still edit, the rooms the viewer may watch that run now, the rooms that open within the next
 * fourteen days, and the closed sittings whose results the viewer may view. A viewer who holds none
 * of those gets four empty lists. `canManageSetup` tells whether the viewer manages the school, so
 * the home reads the school's setup only for a viewer who may.
 */
export const HomeView = Schema.Struct({
  canManageSetup: Schema.Boolean,
  closed: Schema.Array(ClosedView),
  drafts: Schema.Array(ExamSummary),
  live: Schema.Array(SittingView),
  next: Schema.Array(SittingView),
});
