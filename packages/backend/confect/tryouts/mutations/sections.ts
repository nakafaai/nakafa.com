import type { Docs } from "@repo/backend/confect/_generated/docs";
import { SECTION_COMPLETED_RESULT } from "@repo/backend/confect/tryouts/mutations/sections.spec";
export type TryoutAttempt = Docs["tryoutAttempts"];
type TryoutSectionAttempt = Docs["tryoutSectionAttempts"];
type TryoutEndReason = NonNullable<TryoutAttempt["endReason"]>;
export const sectionCompletedResult = Object.freeze({
  kind: SECTION_COMPLETED_RESULT,
});

/** Returns the submitted or expired end reason for a section timer. */
export function getSectionEndReason(
  section: TryoutSectionAttempt,
  now: number
): TryoutEndReason {
  if (now >= section.expiresAt) {
    return "time-expired";
  }
  return "submitted";
}
