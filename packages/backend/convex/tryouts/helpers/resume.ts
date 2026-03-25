import type { Doc } from "@repo/backend/convex/_generated/dataModel";

/** Pick the most recent in-progress part to resume within one tryout. */
export function pickSuggestedPartKey<
  PartAttempt extends {
    partKey: Doc<"tryoutPartAttempts">["partKey"];
    setAttempt: Pick<Doc<"exerciseAttempts">, "lastActivityAt" | "status">;
  },
>(partAttempts: PartAttempt[]) {
  let suggestedPartKey: PartAttempt["partKey"] | undefined;
  let latestActivityAt = Number.NEGATIVE_INFINITY;

  for (const partAttempt of partAttempts) {
    if (partAttempt.setAttempt.status !== "in-progress") {
      continue;
    }

    if (partAttempt.setAttempt.lastActivityAt <= latestActivityAt) {
      continue;
    }

    suggestedPartKey = partAttempt.partKey;
    latestActivityAt = partAttempt.setAttempt.lastActivityAt;
  }

  return suggestedPartKey;
}
