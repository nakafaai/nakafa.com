import { SECTION_COMPLETED_RESULT } from "@repo/backend/confect/tryouts/mutations/sections.spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
export type TryoutAttempt = Doc<"tryoutAttempts">;
export type TryoutSectionAttempt = Doc<"tryoutSectionAttempts">;
export type TryoutEndReason = NonNullable<TryoutAttempt["endReason"]>;
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
