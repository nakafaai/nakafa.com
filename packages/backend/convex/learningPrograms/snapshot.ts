import { PROGRAM_ROW_COUNT } from "@nakafa/aksara-contracts/program/snapshot";
import type { LearningProgram } from "@nakafa/aksara-contracts/program/spec";
import { contentSnapshotId } from "@nakafa/aksara-contracts/release/snapshot-data";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  decodeSnapshotJson,
  decodeSnapshotRowJson,
} from "@repo/backend/convex/contentRelease/parse";
import { loadSnapshot } from "@repo/backend/convex/contentRelease/snapshot/manifest";
import { Effect, Schema } from "effect";

/** A verified immutable program snapshot cannot satisfy its signed contract. */
export class ProgramSnapshotError extends Schema.TaggedError<ProgramSnapshotError>()(
  "ProgramSnapshotError",
  {
    code: Schema.String,
    message: Schema.String,
  }
) {}

/** Creates one typed failure for a missing or inconsistent program snapshot. */
function snapshotFail(code: string, message: string) {
  return Effect.fail(new ProgramSnapshotError({ code, message }));
}

/** Maps stored-contract parse failures into the program source boundary. */
function mapSnapshotError() {
  return new ProgramSnapshotError({
    code: "LEARNING_PROGRAM_SNAPSHOT_INVALID",
    message: "The verified program snapshot does not satisfy its contract.",
  });
}

/**
 * Loads every program from one proof-verified immutable snapshot.
 *
 * This read is suitable for migration preflight before the snapshot becomes
 * globally active. Final runtime reads must first resolve the active release.
 */
export const loadVerifiedProgramCatalog = Effect.fn(
  "learningPrograms.loadVerifiedProgramCatalog"
)(function* (ctx: MutationCtx | QueryCtx, snapshotId: string) {
  const stored = yield* loadSnapshot(ctx, "program", snapshotId);
  if (!stored || stored.verifiedAt === undefined) {
    return yield* snapshotFail(
      "LEARNING_PROGRAM_SNAPSHOT_UNVERIFIED",
      `Program snapshot ${snapshotId} is not proof-verified.`
    );
  }

  const manifest = yield* decodeSnapshotJson(stored.snapshotJson).pipe(
    Effect.mapError(mapSnapshotError)
  );
  if (
    manifest.family !== "program" ||
    contentSnapshotId(manifest) !== snapshotId ||
    manifest.manifest.rowCount !== PROGRAM_ROW_COUNT
  ) {
    return yield* snapshotFail(
      "LEARNING_PROGRAM_SNAPSHOT_INVALID",
      `Program snapshot ${snapshotId} has inconsistent manifest identity.`
    );
  }

  const storedRows = yield* Effect.promise(() =>
    ctx.db
      .query("programRows")
      .withIndex("by_snapshotId_and_index", (query) =>
        query.eq("snapshotId", snapshotId)
      )
      .take(PROGRAM_ROW_COUNT + 1)
  );
  if (storedRows.length !== PROGRAM_ROW_COUNT) {
    return yield* snapshotFail(
      "LEARNING_PROGRAM_SNAPSHOT_INVALID",
      `Program snapshot ${snapshotId} does not contain exactly ${PROGRAM_ROW_COUNT} rows.`
    );
  }

  const programs: LearningProgram[] = [];
  for (const [index, storedRow] of storedRows.entries()) {
    const source = yield* decodeSnapshotRowJson(storedRow.rowJson).pipe(
      Effect.mapError(mapSnapshotError)
    );
    if (
      source.family !== "program" ||
      storedRow.index !== index ||
      storedRow.programKey !== source.record.row.key ||
      storedRow.rowHash !== source.record.rowHash
    ) {
      return yield* snapshotFail(
        "LEARNING_PROGRAM_SNAPSHOT_INVALID",
        `Program snapshot ${snapshotId} row ${index} lost its signed identity.`
      );
    }
    programs.push(source.record.row);
  }

  return programs;
});
