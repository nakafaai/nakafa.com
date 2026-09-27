import type { Docs } from "@repo/backend/confect/_generated/docs";

export type TryoutFinishedSectionStatus = Exclude<
  Docs["tryoutSectionAttempts"]["status"],
  "in-progress"
>;

/** Reads the canonical terminal status from one Convex section attempt. */
export function getTryoutFinishedSectionStatus(
  section: Pick<Docs["tryoutSectionAttempts"], "status"> | null
): TryoutFinishedSectionStatus | null {
  if (!section || section.status === "in-progress") {
    return null;
  }

  return section.status;
}
