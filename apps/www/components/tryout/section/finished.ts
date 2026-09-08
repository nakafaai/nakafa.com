import type { Doc } from "@repo/backend/convex/_generated/dataModel";

export type TryoutFinishedSectionStatus = Exclude<
  Doc<"tryoutSectionAttempts">["status"],
  "in-progress"
>;

/** Reads the canonical terminal status from one Convex section attempt. */
export function getTryoutFinishedSectionStatus(
  section: Pick<Doc<"tryoutSectionAttempts">, "status"> | null
): TryoutFinishedSectionStatus | null {
  if (!section || section.status === "in-progress") {
    return null;
  }

  return section.status;
}
