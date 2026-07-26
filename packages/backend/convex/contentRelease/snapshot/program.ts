import type { ContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot-data";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  ensureDocumentSize,
  READ_MODEL_DOCUMENT_LIMIT,
} from "@repo/backend/convex/contentRelease/document";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

type ProgramRow = Extract<ContentSnapshotRow, { readonly family: "program" }>;
type ProgramRecord = Extract<
  ProgramRow["record"],
  { readonly kind: "program" }
>;
type CurriculumRecord = Extract<
  ProgramRow["record"],
  { readonly kind: "curriculum" }
>;

/** Rejects any global row-index collision across the two program tables. */
const loadProgramIndex = Effect.fn("contentRelease.loadProgramIndex")(
  function* (ctx: MutationCtx, snapshotId: string, index: number) {
    return yield* Effect.all([
      Effect.promise(() =>
        ctx.db
          .query("programCatalog")
          .withIndex("by_snapshotId_and_index", (query) =>
            query.eq("snapshotId", snapshotId).eq("index", index)
          )
          .unique()
      ),
      Effect.promise(() =>
        ctx.db
          .query("curriculumRoutes")
          .withIndex("by_snapshotId_and_index", (query) =>
            query.eq("snapshotId", snapshotId).eq("index", index)
          )
          .unique()
      ),
    ]);
  }
);

/** Stores one immutable learning-program catalog row. */
const stageProgram = Effect.fn("contentRelease.stageProgram")(function* (
  ctx: MutationCtx,
  snapshotId: string,
  index: number,
  record: ProgramRecord,
  rowJson: string
) {
  const [storedProgram, storedCurriculum] = yield* loadProgramIndex(
    ctx,
    snapshotId,
    index
  );
  const byIdentity = yield* Effect.promise(() =>
    ctx.db
      .query("programCatalog")
      .withIndex("by_snapshotId_and_programKey", (query) =>
        query.eq("snapshotId", snapshotId).eq("programKey", record.row.key)
      )
      .unique()
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
  yield* Effect.promise(() => ctx.db.insert("programCatalog", row));
  return false;
});

/** Stores one immutable localized curriculum route row. */
const stageCurriculum = Effect.fn("contentRelease.stageCurriculum")(function* (
  ctx: MutationCtx,
  snapshotId: string,
  index: number,
  record: CurriculumRecord,
  rowJson: string
) {
  const [storedProgram, storedCurriculum] = yield* loadProgramIndex(
    ctx,
    snapshotId,
    index
  );
  const [byPath, byNode] = yield* Effect.all([
    Effect.promise(() =>
      ctx.db
        .query("curriculumRoutes")
        .withIndex("by_snapshotId_and_locale_and_path", (query) =>
          query
            .eq("snapshotId", snapshotId)
            .eq("locale", record.row.locale)
            .eq("path", record.row.publicPath)
        )
        .unique()
    ),
    Effect.promise(() =>
      ctx.db
        .query("curriculumRoutes")
        .withIndex(
          "by_snapshotId_and_locale_and_programKey_and_nodeKey",
          (query) =>
            query
              .eq("snapshotId", snapshotId)
              .eq("locale", record.row.locale)
              .eq("programKey", record.row.programKey)
              .eq("nodeKey", record.row.nodeKey)
        )
        .unique()
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
    return true;
  }
  const row = {
    index,
    level: record.row.level,
    locale: record.row.locale,
    contextPath: record.row.materialContextParentPath,
    materialKey: record.row.materialKey,
    nodeKey: record.row.nodeKey,
    order: record.row.order,
    parentPath: record.row.parentPath,
    programKey: record.row.programKey,
    path: record.row.publicPath,
    rowHash: record.rowHash,
    rowJson,
    snapshotId,
    sourcePath: record.row.sourcePath,
  };
  yield* ensureDocumentSize(
    `Program snapshot ${snapshotId} curriculum row ${index}`,
    row,
    READ_MODEL_DOCUMENT_LIMIT
  );
  yield* Effect.promise(() => ctx.db.insert("curriculumRoutes", row));
  return false;
});

/** Stores one decoded program-family row in its cohesive physical table. */
export function stageProgramRow(
  ctx: MutationCtx,
  snapshotId: string,
  index: number,
  source: ProgramRow,
  rowJson: string
) {
  return source.record.kind === "program"
    ? stageProgram(ctx, snapshotId, index, source.record, rowJson)
    : stageCurriculum(ctx, snapshotId, index, source.record, rowJson);
}
