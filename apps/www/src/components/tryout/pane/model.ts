import {
  AWARD_RULES,
  EMPTY_TALLY,
} from "@repo/backend/confect/progress/schema";
import type {
  Growth,
  SetClaims as SetClaimsSchema,
} from "@repo/backend/confect/progress/view";
import { Array as Arr, HashSet, Option, Schema } from "effect";
import type { CurrentAttempt } from "@/components/tryout/set/model";

type SetClaims = typeof SetClaimsSchema.Type;

/** The two modes a learner can switch between in a set's pane: timed simulation or untimed practice. */
export const SetPaneModeSchema = Schema.Literals(["simulation", "practice"]);
export type SetPaneMode = typeof SetPaneModeSchema.Type;

/** Compact practice progress of one section in the current set. */
const PracticeSectionSummarySchema = Schema.Struct({
  checkedCount: Schema.Finite,
  questionCount: Schema.Finite,
  sectionKey: Schema.String,
});
type PracticeSectionSummary = typeof PracticeSectionSummarySchema.Type;

const SelectPracticePathInputSchema = Schema.Struct({
  sections: Schema.Array(
    Schema.Struct({
      publicPath: Schema.optionalKey(Schema.String),
      sectionKey: Schema.String,
    })
  ),
  setPublicPath: Schema.String,
  summaries: Schema.Array(PracticeSectionSummarySchema),
});
type SelectPracticePathInput = typeof SelectPracticePathInputSchema.Type;

/** A set nobody has claimed anything of yet, as a visitor's pane reads it. */
export const NO_CLAIMS: SetClaims = { sections: [], set: false, stars: 0 };

/** How far a learner with no progress yet grew: nothing, so they stand at level 1. */
export const NO_GROWTH: typeof Growth.Type = {
  lifetime: 0,
  tally: EMPTY_TALLY,
};

/**
 * The Stars a set still gives a learner (ADR 0042, D8): each of its sections' Stars they do not hold yet, then the
 * set's own unless they hold it. A section's grant is once for good, so finishing a set again gives nothing.
 */
export function starsLeft(sectionKeys: readonly string[], claims: SetClaims) {
  const held = HashSet.fromIterable(claims.sections);
  const sections = Arr.countBy(sectionKeys, (key) => !HashSet.has(held, key));
  return (
    sections * AWARD_RULES.section.stars +
    (claims.set ? 0 : AWARD_RULES.set.stars)
  );
}

/** Where a part of a set stands on the learner's way through the attempt the pane shows. */
export type PartStep = "done" | "missed" | "next" | "todo";

/**
 * The step of one part: done once the attempt finished it, next while the running attempt resumes there, missed once
 * an ended attempt left it unfinished, and still to do otherwise, as for a set the learner has not started.
 */
export function partStep(
  attempt: Pick<
    CurrentAttempt,
    "completedSectionKeys" | "resumeSectionKey" | "status"
  > | null,
  sectionKey: string
): PartStep {
  if (attempt === null) {
    return "todo";
  }
  if (Arr.contains(attempt.completedSectionKeys, sectionKey)) {
    return "done";
  }
  if (attempt.status !== "in-progress") {
    return "missed";
  }
  return attempt.resumeSectionKey === sectionKey ? "next" : "todo";
}

/** The scored summary of one completed part in the attempt the pane shows. */
export type PartScoreSummary = CurrentAttempt["sectionScores"][number];

/** The score summary of one completed part in the attempt the pane shows, if that part has been scored. */
export function partScore(
  attempt: Pick<CurrentAttempt, "sectionScores"> | null,
  sectionKey: string
): Option.Option<PartScoreSummary> {
  if (attempt === null) {
    return Option.none();
  }
  return Arr.findFirst(
    attempt.sectionScores,
    (entry) => entry.sectionKey === sectionKey
  );
}

/** The practice progress summary of one section in the current set, if the learner has started practising it. */
export function partPracticeSummary(
  summaries: readonly PracticeSectionSummary[],
  sectionKey: string
): Option.Option<PracticeSectionSummary> {
  return Arr.findFirst(summaries, (entry) => entry.sectionKey === sectionKey);
}

/**
 * Selects the best section path to open when pressing the practice footer CTA: the first section with
 * remaining unchecked questions, or else the first section of the set.
 */
export function selectPracticePath(input: SelectPracticePathInput): string {
  const unfinished = Arr.findFirst(input.sections, (section) =>
    Option.match(partPracticeSummary(input.summaries, section.sectionKey), {
      onNone: () => true,
      onSome: (summary) => summary.checkedCount < summary.questionCount,
    })
  );
  const chosen = Option.orElse(unfinished, () => Arr.head(input.sections));
  return Option.match(chosen, {
    onNone: () => input.setPublicPath,
    onSome: (section) => section.publicPath ?? input.setPublicPath,
  });
}
