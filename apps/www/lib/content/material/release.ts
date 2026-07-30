import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect, Schema } from "effect";
import type { MaterialProjectionIdentity } from "@/lib/content/material/decode";
import { makeMaterialProjectionError } from "@/lib/content/material/decode";
import type { ActiveContentReleaseId } from "@/lib/content/published/active";
import { PublishedReleaseMismatchError } from "@/lib/content/published/errors";

/** Active material release identity shared across one multi-read request. */
export type MaterialReleasePin = ActiveContentReleaseId | null;

/** Decodes and verifies the active release returned by one material read. */
export const decodeMaterialReleasePin = Effect.fn(
  "NakafaMaterial.decodeReleasePin"
)(function* (
  actual: unknown,
  expected: MaterialReleasePin | undefined,
  identity: MaterialProjectionIdentity
) {
  const activeReleaseId = yield* Schema.decodeUnknown(
    Schema.NullOr(ReleaseIdSchema)
  )(actual).pipe(Effect.mapError(() => makeMaterialProjectionError(identity)));
  if (expected !== undefined && activeReleaseId !== expected) {
    return yield* new PublishedReleaseMismatchError({
      actualReleaseId: activeReleaseId,
      expectedReleaseId: expected,
    });
  }
  return activeReleaseId;
});
