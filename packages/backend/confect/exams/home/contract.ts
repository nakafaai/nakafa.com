import { ExamSummary } from "@repo/backend/confect/exams/exam";
import { SittingView } from "@repo/backend/confect/exams/sittings/contract";
import { HomeSetup } from "@repo/backend/confect/tenancy/home.spec";
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
 * One draft that the school home lists: the exam, and when its author created it, which the home shows as the time
 * since. Exams keep no edit time, so the creation time is the only time of a draft.
 */
export const HomeDraft = Schema.Struct({
  ...ExamSummary.fields,
  createdAt: Schema.Finite,
});

/**
 * What the school home shows a viewer about exams: the viewer's own drafts that the viewer may
 * still edit, the rooms the viewer may watch that run now, the rooms that open within the next
 * fourteen days, and the closed sittings whose results the viewer may view. A viewer who holds none
 * of those gets four empty lists. `canManageSetup` tells whether the viewer manages the school. Only
 * such a viewer gets `setup`, the school's setup, which the home's setup tile starts from. `draftsBounded` tells
 * whether the drafts read stopped at its bound, so a draft of the viewer may exist beyond the drafts listed.
 */
export const HomeView = Schema.Struct({
  canManageSetup: Schema.Boolean,
  closed: Schema.Array(ClosedView),
  draftsBounded: Schema.Boolean,
  drafts: Schema.Array(HomeDraft),
  live: Schema.Array(SittingView),
  next: Schema.Array(SittingView),
  setup: Schema.optionalKey(HomeSetup),
});
