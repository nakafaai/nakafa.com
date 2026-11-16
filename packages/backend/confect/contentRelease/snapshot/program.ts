import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { addProgramBucketRoute } from "@repo/backend/confect/contentRelease/program/bucket";
import type {
  CurriculumDocumentSchema,
  ProgramDocumentSchema,
} from "@repo/backend/confect/contentRelease/snapshot/shape";
import { Effect } from "effect";

/** Rejects any global row-index collision across the two program tables. */
const loadProgramIndex = Effect.fn("contentRelease.loadProgramIndex")(
  function* (snapshotId: string, index: number) {
    const database = yield* DatabaseReader;
    return yield* Effect.all([
      database
        .table("programCatalog")
        .get("by_snapshotId_and_index", snapshotId, index)
        .pipe(
          Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
          Effect.orDie
        ),
      database
        .table("curriculumRoutes")
        .get("by_snapshotId_and_index", snapshotId, index)
        .pipe(
          Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
          Effect.orDie
        ),
    ]);
  }
);

/** Stores one prepared immutable learning-program catalog row. */
export const stageProgram = Effect.fn("contentRelease.stageProgram")(function* (
  snapshotId: string,
  index: number,
  document: typeof ProgramDocumentSchema.Type
) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const [storedProgram, storedCurriculum] = yield* loadProgramIndex(
    snapshotId,
    index
  );
  const byIdentity = yield* database
    .table("programCatalog")
    .get("by_snapshotId_and_programKey", snapshotId, document.programKey)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (storedProgram || storedCurriculum || byIdentity) {
    if (
      storedCurriculum ||
      !(storedProgram && byIdentity) ||
      storedProgram._id !== byIdentity._id ||
      storedProgram.rowJson !== document.rowJson ||
      storedProgram.rowHash !== document.rowHash
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Program snapshot ${snapshotId} has a catalog identity collision.`
      );
    }
    return true;
  }
  yield* writer
    .table("programCatalog")
    .insert({ ...document, index, snapshotId })
    .pipe(Effect.orDie);
  return false;
});

/** Stores one prepared immutable localized curriculum route row. */
export const stageCurriculum = Effect.fn("contentRelease.stageCurriculum")(
  function* (
    snapshotId: string,
    index: number,
    document: typeof CurriculumDocumentSchema.Type
  ) {
    const database = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const [storedProgram, storedCurriculum] = yield* loadProgramIndex(
      snapshotId,
      index
    );
    const [byPath, byNode] = yield* Effect.all([
      database
        .table("curriculumRoutes")
        .get(
          "by_snapshotId_and_appLocale_and_path",
          snapshotId,
          document.appLocale,
          document.path
        )
        .pipe(
          Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
          Effect.orDie
        ),
      database
        .table("curriculumRoutes")
        .get(
          "by_snapshotId_and_appLocale_and_programKey_and_nodeKey",
          snapshotId,
          document.appLocale,
          document.programKey,
          document.nodeKey
        )
        .pipe(
          Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
          Effect.orDie
        ),
    ]);
    if (storedProgram || storedCurriculum || byPath || byNode) {
      if (
        storedProgram ||
        !(storedCurriculum && byPath && byNode) ||
        storedCurriculum._id !== byPath._id ||
        storedCurriculum._id !== byNode._id ||
        storedCurriculum.rowJson !== document.rowJson ||
        storedCurriculum.rowHash !== document.rowHash
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_CONFLICT",
          `Program snapshot ${snapshotId} has a curriculum identity collision.`
        );
      }
      if (storedCurriculum.bucket !== document.bucket) {
        return yield* releaseFail(
          "CONTENT_RELEASE_CONFLICT",
          `Program snapshot ${snapshotId} has a curriculum bucket collision.`
        );
      }
      return true;
    }
    yield* writer
      .table("curriculumRoutes")
      .insert({ ...document, index, snapshotId })
      .pipe(Effect.orDie);
    if (document.bucket !== undefined) {
      yield* addProgramBucketRoute(
        snapshotId,
        index,
        document.appLocale,
        document.bucket
      );
    }
    return false;
  }
);
