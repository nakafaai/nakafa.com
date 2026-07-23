import { hashText } from "@repo/backend/convex/contentRelease/digest";
import { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { Effect, Schema } from "effect";

const BatchKindSchema = Schema.Literal(
  "artifact",
  "item",
  "projection",
  "route"
);

/** Computes the exact ordered request identity for idempotent batch retries. */
export const hashBatch = Effect.fn("contentRelease.hashBatch")(function* (
  kind: typeof BatchKindSchema.Type,
  releaseId: string,
  batchIndex: number,
  values: readonly string[]
) {
  return yield* hashText(
    "the immutable publication batch",
    JSON.stringify([kind, releaseId, batchIndex, values])
  );
});

/** Rejects one immutable batch index reused with different exact bytes. */
export function validateStoredBatch(
  actualRows: number,
  expectedRows: number,
  hashes: readonly (string | undefined)[],
  expectedHash: string,
  releaseId: string,
  batchIndex: number
) {
  if (
    actualRows === expectedRows &&
    hashes.every((hash) => hash === expectedHash)
  ) {
    return Effect.void;
  }
  return Effect.fail(
    new ReleaseError({
      code: "CONTENT_RELEASE_CONFLICT",
      message: `Batch ${batchIndex} for release ${releaseId} was reused with different bytes.`,
    })
  );
}
