import type { Doc } from "@repo/backend/convex/_generated/dataModel";

export type TryoutFinishedSectionStatus = Exclude<
  Doc<"tryoutSectionAttempts">["status"],
  "in-progress"
>;

type TryoutStatusTranslator = (
  key:
    | "part-head-completed"
    | "part-head-completed-pending-review"
    | "part-head-completed-time-expired"
    | "part-head-completed-time-expired-pending-review"
) => string;

/** Reads the canonical terminal status from one Convex section attempt. */
export function getTryoutFinishedSectionStatus(
  section: Pick<Doc<"tryoutSectionAttempts">, "status"> | null
): TryoutFinishedSectionStatus | null {
  if (!section || section.status === "in-progress") {
    return null;
  }

  return section.status;
}

/** Selects the production header copy for finished try-out sections. */
export function getTryoutFinishedSectionDescription({
  attemptFinished,
  sectionTimeExpired,
  tTryouts,
}: {
  attemptFinished: boolean;
  sectionTimeExpired: boolean;
  tTryouts: TryoutStatusTranslator;
}) {
  if (sectionTimeExpired && attemptFinished) {
    return tTryouts("part-head-completed-time-expired");
  }

  if (sectionTimeExpired) {
    return tTryouts("part-head-completed-time-expired-pending-review");
  }

  if (attemptFinished) {
    return tTryouts("part-head-completed");
  }

  return tTryouts("part-head-completed-pending-review");
}
