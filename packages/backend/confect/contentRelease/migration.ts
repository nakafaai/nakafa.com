import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { RETIRED_CONTENT_GENERATION } from "@repo/backend/confect/contentRelease/generation";
import type { markRetiredGenerationResult } from "@repo/backend/confect/contentRelease/migration.spec";
import { loadState } from "@repo/backend/confect/contentRelease/model";
import { Clock, Effect } from "effect";

/**
 * Records that the active release belongs to the retired generation. A release
 * that was published before the bootstrap has no generation recorded, so this
 * writes the retired one exactly once, and a repeated run changes nothing.
 */
export const markRetiredGeneration = Effect.fn(
  "contentRelease.migration.markRetiredGeneration"
)(function* () {
  const writer = yield* DatabaseWriter;
  const state = yield* loadState();
  if (!state?.activeReleaseId) {
    return {
      outcome: "noActiveRelease",
    } satisfies typeof markRetiredGenerationResult.Type;
  }
  if (state.activeContentGeneration !== undefined) {
    return {
      outcome: "alreadyRecorded",
    } satisfies typeof markRetiredGenerationResult.Type;
  }
  const now = yield* Clock.currentTimeMillis;
  yield* writer
    .table("contentState")
    .patch(state._id, {
      activeContentGeneration: RETIRED_CONTENT_GENERATION,
      updatedAt: now,
    })
    .pipe(Effect.orDie);
  return {
    outcome: "marked",
  } satisfies typeof markRetiredGenerationResult.Type;
});
