type TryoutStatusTranslator = (
  key:
    | "part-head-completed"
    | "part-head-completed-pending-review"
    | "part-head-completed-time-expired"
    | "part-head-completed-time-expired-pending-review"
) => string;

/** Selects the production header copy for finished try-out sections. */
export function getTryoutFinishedSectionStatus({
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
