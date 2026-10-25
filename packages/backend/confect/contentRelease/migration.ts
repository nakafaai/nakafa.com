import { ContentUpsertSchema } from "@nakafa/aksara-contracts/release";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  isRetiredFormatArtifact,
  RETIRED_CONTENT_GENERATION,
} from "@repo/backend/confect/contentRelease/generation";
import type { markRetiredGenerationResult } from "@repo/backend/confect/contentRelease/migration.spec";
import { loadState } from "@repo/backend/confect/contentRelease/model";
import { Array as Arr, Clock, Effect, Option } from "effect";

/** Heads read at most while looking for the witness of the active generation. */
const WITNESS_HEAD_LIMIT = 64;

/**
 * Reads the stored artifact of the first upserted head of one release. A
 * release compiles its artifacts under one contract generation, so one stored
 * artifact witnesses the generation the whole release was published under.
 */
const loadWitnessArtifact = Effect.fn(
  "contentRelease.migration.loadWitnessArtifact"
)(function* (releaseId: string) {
  const database = yield* DatabaseReader;
  const heads = yield* database
    .table("contentHeads")
    .index("by_releaseId_and_index", (query) =>
      query.eq("releaseId", releaseId)
    )
    .take(WITNESS_HEAD_LIMIT)
    .pipe(Effect.orDie);
  const artifactHash = Option.flatMap(
    Arr.findFirst(
      heads,
      (head) => head.operation === ContentUpsertSchema.fields.operation.literal
    ),
    (head) => Option.fromNullishOr(head.artifactHash)
  );
  if (Option.isNone(artifactHash)) {
    return Option.none<string>();
  }
  const stored = yield* database
    .table("contentArtifacts")
    .get("by_artifactHash", artifactHash.value)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  return Option.fromNullishOr(stored?.artifactJson);
});

/**
 * Records that the active release belongs to the retired generation. A release
 * that was published before the bootstrap has no generation recorded, so this
 * writes the retired one exactly once, and only when a stored artifact of that
 * release carries the retired format. A repeated run changes nothing.
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
  const witness = yield* loadWitnessArtifact(state.activeReleaseId);
  if (Option.isNone(witness)) {
    return {
      outcome: "unverifiable",
    } satisfies typeof markRetiredGenerationResult.Type;
  }
  if (!isRetiredFormatArtifact(witness.value)) {
    return {
      outcome: "notRetired",
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
