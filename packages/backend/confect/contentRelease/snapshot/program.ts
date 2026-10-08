import type {
  CurriculumRouteRecordSchema,
  LearningProgramRecordSchema,
} from "@nakafa/aksara-contracts/program/snapshot/row";
import { ContentSnapshotRowSchema } from "@nakafa/aksara-contracts/release/snapshot/data";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { getHashBucket } from "@repo/backend/confect/contentRelease/bucket";
import {
  ensureDocumentSize,
  READ_MODEL_DOCUMENT_LIMIT,
} from "@repo/backend/confect/contentRelease/document";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { addProgramBucketRoute } from "@repo/backend/confect/contentRelease/program/bucket";
import { Effect } from "effect";

const ProgramRowSchema = ContentSnapshotRowSchema.members[0];
type ProgramRow = typeof ProgramRowSchema.Type;
type ProgramRecord = typeof LearningProgramRecordSchema.Type;
type CurriculumRecord = typeof CurriculumRouteRecordSchema.Type;

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

/** Stores one immutable learning-program catalog row. */
const stageProgram = Effect.fn("contentRelease.stageProgram")(function* (
  snapshotId: string,
  index: number,
  record: ProgramRecord,
  rowJson: string
) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const [storedProgram, storedCurriculum] = yield* loadProgramIndex(
    snapshotId,
    index
  );
  const byIdentity = yield* database
    .table("programCatalog")
    .get("by_snapshotId_and_programKey", snapshotId, record.row.key)
    .pipe(
      Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)),
      Effect.orDie
    );
  if (storedProgram || storedCurriculum || byIdentity) {
    if (
      storedCurriculum ||
      !(storedProgram && byIdentity) ||
      storedProgram._id !== byIdentity._id ||
      storedProgram.rowJson !== rowJson ||
      storedProgram.rowHash !== record.rowHash
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Program snapshot ${snapshotId} has a catalog identity collision.`
      );
    }
    return true;
  }
  const row = {
    displayOrder: record.row.displayOrder,
    index,
    programKey: record.row.key,
    rowHash: record.rowHash,
    rowJson,
    snapshotId,
  };
  yield* ensureDocumentSize(
    `Program snapshot ${snapshotId} catalog row ${index}`,
    row,
    READ_MODEL_DOCUMENT_LIMIT
  );
  yield* writer.table("programCatalog").insert(row).pipe(Effect.orDie);
  return false;
});

/** Stores one immutable localized curriculum route row. */
const stageCurriculum = Effect.fn("contentRelease.stageCurriculum")(function* (
  snapshotId: string,
  index: number,
  record: CurriculumRecord,
  rowJson: string
) {
  const database = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const bucket = getHashBucket(record.rowHash);
  const row = {
    ...(record.row.sitemap
      ? {
          bucket,
        }
      : {}),
    appLocale: record.row.appLocale,
    index,
    level: record.row.level,
    ...(record.row.materialContextParentPath === undefined
      ? {}
      : {
          contextPath: record.row.materialContextParentPath,
        }),
    ...(record.row.materialKey === undefined
      ? {}
      : {
          materialKey: record.row.materialKey,
        }),
    nodeKey: record.row.nodeKey,
    order: record.row.order,
    ...(record.row.parentPath === undefined
      ? {}
      : {
          parentPath: record.row.parentPath,
        }),
    programKey: record.row.programKey,
    path: record.row.publicPath,
    rowHash: record.rowHash,
    rowJson,
    snapshotId,
    sourcePath: record.row.sourcePath,
  };
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
        record.row.appLocale,
        record.row.publicPath
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
        record.row.appLocale,
        record.row.programKey,
        record.row.nodeKey
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
      storedCurriculum.rowJson !== rowJson ||
      storedCurriculum.rowHash !== record.rowHash
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Program snapshot ${snapshotId} has a curriculum identity collision.`
      );
    }
    if (storedCurriculum.bucket !== row.bucket) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Program snapshot ${snapshotId} has a curriculum bucket collision.`
      );
    }
    return true;
  }
  yield* ensureDocumentSize(
    `Program snapshot ${snapshotId} curriculum row ${index}`,
    row,
    READ_MODEL_DOCUMENT_LIMIT
  );
  yield* writer.table("curriculumRoutes").insert(row).pipe(Effect.orDie);
  if (row.bucket !== undefined) {
    yield* addProgramBucketRoute(
      snapshotId,
      index,
      record.row.appLocale,
      row.bucket
    );
  }
  return false;
});

/** Stores one decoded program-family row in its cohesive physical table. */
export function stageProgramRow(
  snapshotId: string,
  index: number,
  source: ProgramRow,
  rowJson: string
) {
  return source.record.kind === "program"
    ? stageProgram(snapshotId, index, source.record, rowJson)
    : stageCurriculum(snapshotId, index, source.record, rowJson);
}
