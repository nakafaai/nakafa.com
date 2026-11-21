import { AWARD_RULES, EMPTY_TALLY } from "@repo/backend/confect/island/schema";
import type {
  Growth,
  SetClaims as SetClaimsSchema,
} from "@repo/backend/confect/island/view";
import { Array as Arr, HashSet, Option } from "effect";
import type { CurrentAttempt } from "@/components/tryout/set/model";

type SetClaims = typeof SetClaimsSchema.Type;

/** A set nobody has claimed anything of yet, as a visitor's pane reads it. */
export const NO_CLAIMS: SetClaims = { sections: [], set: false, stars: 0 };

/** How far a learner with no island yet grew: nothing, so they stand at level 1. */
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

/** The published score of one completed part in the attempt the pane shows, if that part has been scored. */
export function partScore(
  attempt: Pick<CurrentAttempt, "sectionScores"> | null,
  sectionKey: string
): Option.Option<number> {
  if (attempt === null) {
    return Option.none();
  }
  return Option.map(
    Arr.findFirst(
      attempt.sectionScores,
      (entry) => entry.sectionKey === sectionKey
    ),
    (entry) => entry.publishedScore
  );
}
