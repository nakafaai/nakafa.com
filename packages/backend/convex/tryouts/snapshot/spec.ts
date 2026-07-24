import type { TryoutPlacement } from "@nakafa/aksara-contracts/tryout/spec";
import type { ConvexTaggedError } from "@repo/backend/convex/lib/effect";
import { Effect, Schema } from "effect";

/** Stable fields copied from one signed set into durable attempt state. */
export interface StableTryoutSet {
  readonly countryKey: string;
  readonly examKey: string;
  readonly identity: string;
  readonly locale: "en" | "id";
  readonly setKey: string;
  readonly trackKey: string;
}

/** Mutable sync fields that must match one signed set catalog row. */
export interface TryoutSetEvidence {
  readonly countryKey: string;
  readonly examKey: string;
  readonly locale: "en" | "id";
  readonly publicPath: string;
  readonly scoringStrategy: "irt" | "raw" | "weighted";
  readonly sectionCount: number;
  readonly setKey: string;
  readonly sourceRevision: string;
  readonly totalQuestionCount: number;
  readonly trackKey: string;
}

/** One proof-verified active set identity selected for a new attempt. */
export interface ActiveTryoutSet {
  readonly set: StableTryoutSet;
  readonly snapshotId: string;
}

/** Synchronized section fields that must match one signed catalog row. */
export interface TryoutSectionEvidence {
  readonly questionCount: number;
  readonly sectionKey: string;
  readonly sourceRevision: string;
  readonly timeLimitSeconds: number;
}

/** Legacy question evidence matched against one signed placement row. */
export interface TryoutPlacementEvidence {
  readonly answerContentKey: string;
  readonly choices: readonly TryoutPlacement["choices"][number][];
  readonly locale: "en" | "id";
  readonly questionContentKey: string;
  readonly questionOrder: number;
  readonly sourceRevision: string;
  readonly title: string;
}

/** Signed immutable placement values copied into durable attempt state. */
export interface StableTryoutPlacement {
  readonly identity: string;
  readonly row: TryoutPlacement;
  readonly rowHash: string;
}

/** Expected failure while binding mutable try-out rows to signed content. */
export class TryoutSnapshotError
  extends Schema.TaggedError<TryoutSnapshotError>()("TryoutSnapshotError", {
    code: Schema.String,
    message: Schema.String,
  })
  implements ConvexTaggedError
{
  declare readonly code: string;
  declare readonly message: string;
}

/** Fails one snapshot-binding program with an exact integrity error. */
export function tryoutSnapshotFail(code: string, message: string) {
  return Effect.fail(new TryoutSnapshotError({ code, message }));
}
