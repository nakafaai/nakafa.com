import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import { getFirstIncompleteTryoutPartIndex } from "@repo/backend/convex/tryouts/helpers/metrics";

/** Pick the most recent in-progress part to resume within one tryout. */
function pickSuggestedPartKey<
  PartAttempt extends {
    partKey: Doc<"tryoutPartAttempts">["partKey"];
    setAttempt: Pick<
      Doc<"exerciseAttempts">,
      "lastActivityAt" | "status"
    > | null;
  },
>(partAttempts: PartAttempt[]) {
  let suggestedPartKey: PartAttempt["partKey"] | undefined;
  let latestActivityAt = Number.NEGATIVE_INFINITY;

  for (const partAttempt of partAttempts) {
    if (partAttempt.setAttempt?.status !== "in-progress") {
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

/** Derive the next resume target for an active tryout attempt. */
export function resolveResumePartKey({
  completedPartIndices,
  orderedParts,
  partAttempts,
}: {
  completedPartIndices: Doc<"tryoutAttempts">["completedPartIndices"];
  orderedParts: Pick<Doc<"tryoutPartSets">, "partIndex" | "partKey">[];
  partAttempts: Array<{
    partKey: Doc<"tryoutPartAttempts">["partKey"];
    setAttempt: Pick<
      Doc<"exerciseAttempts">,
      "lastActivityAt" | "status"
    > | null;
  }>;
}) {
  const suggestedPartKey = pickSuggestedPartKey(partAttempts);
  const nextPartIndex = getFirstIncompleteTryoutPartIndex({
    completedPartIndices,
    partCount: orderedParts.length,
  });
  const nextPart =
    nextPartIndex === undefined ? undefined : orderedParts[nextPartIndex];

  return suggestedPartKey ?? nextPart?.partKey;
}
