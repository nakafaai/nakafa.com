import { getFirstIncompleteTryoutPartIndex } from "@repo/backend/confect/modules/tryout/tryoutMetrics.service";
import type { TryoutStatus } from "@repo/backend/confect/modules/tryout/tryouts.tables";

interface OrderedPart {
  readonly partIndex: number;
  readonly partKey: string;
}

type PartAttemptForResume = OrderedPart & {
  readonly setAttempt: {
    readonly lastActivityAt: number;
    readonly status: TryoutStatus;
  } | null;
};

/** Picks the best part key for resuming an in-progress tryout. */
export function resolveResumePartKey(args: {
  readonly completedPartIndices: readonly number[];
  readonly orderedParts: readonly OrderedPart[];
  readonly partAttempts: readonly PartAttemptForResume[];
}) {
  const latestPartAttempt =
    [...args.partAttempts]
      .filter((partAttempt) => partAttempt.setAttempt?.status === "in-progress")
      .sort(
        (left, right) =>
          (right.setAttempt?.lastActivityAt ?? Number.NEGATIVE_INFINITY) -
          (left.setAttempt?.lastActivityAt ?? Number.NEGATIVE_INFINITY)
      )[0] ?? null;
  const suggestedPartKey = latestPartAttempt?.partKey ?? null;

  const nextPartIndex = getFirstIncompleteTryoutPartIndex({
    completedPartIndices: args.completedPartIndices,
    partCount: args.orderedParts.length,
  });
  const nextPart =
    nextPartIndex === undefined ? undefined : args.orderedParts[nextPartIndex];

  return suggestedPartKey ?? nextPart?.partKey;
}
