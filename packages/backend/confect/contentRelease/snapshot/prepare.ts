import type { AssessmentRecord } from "@nakafa/aksara-contracts/assessment/snapshot";
import type {
  CurriculumRouteRecordSchema,
  LearningProgramRecordSchema,
} from "@nakafa/aksara-contracts/program/snapshot/row";
import type { ContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import { contentSnapshotId } from "@nakafa/aksara-contracts/release/snapshot/data";
import type { ContentSnapshotKind } from "@nakafa/aksara-contracts/release/snapshot/scope";
import { snapshotRowCount } from "@nakafa/aksara-contracts/release/snapshot/spec";
import {
  MAX_SNAPSHOT_BATCH_BYTES,
  MAX_SNAPSHOT_BATCH_COUNT,
} from "@nakafa/aksara-contracts/transport/limits";
import type { StageSnapshotBatchInputSchema } from "@nakafa/aksara-contracts/transport/snapshot";
import { assessmentRowFacts } from "@repo/backend/confect/contentRelease/assessment/facts";
import { hashBatch } from "@repo/backend/confect/contentRelease/batch";
import { getHashBucket } from "@repo/backend/confect/contentRelease/bucket";
import {
  ensureDocumentSize,
  READ_MODEL_DOCUMENT_LIMIT,
} from "@repo/backend/confect/contentRelease/document";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  decodeReleaseJson,
  decodeSnapshotJson,
} from "@repo/backend/confect/contentRelease/parse";
import {
  quranRowFacts,
  quranSearchFacts,
} from "@repo/backend/confect/contentRelease/quran/facts";
import {
  QURAN_SEARCH_DOCUMENT_LIMIT,
  quranRowDocumentLimit,
} from "@repo/backend/confect/contentRelease/quran/limits";
import type {
  batchContextValidator,
  stageBatchArgsValidator,
} from "@repo/backend/confect/contentRelease/snapshot/batch.spec";
import type { PreparedRowSchema } from "@repo/backend/confect/contentRelease/snapshot/shape";
import { encodeSnapshotRowJson } from "@repo/backend/confect/contentRelease/wire";
import type { PublishedQuranRow } from "@repo/backend/content/quran/contract";
import { getConvexSize } from "convex/values";
import { Array as Arr, Effect, Schema } from "effect";

type PreparedRow = typeof PreparedRowSchema.Type;

/** Where one row sits in its batch, named in every size failure. */
const RowPlaceSchema = Schema.Struct({
  batchIndex: Schema.Finite,
  offset: Schema.Finite,
  snapshotId: Schema.String,
});
type RowPlace = typeof RowPlaceSchema.Type;

/**
 * Sizes one document exactly as the mutation stores it. An index is a float64
 * whatever its value, so a placeholder index sizes the stored document.
 */
function sizeDocument(
  label: string,
  place: RowPlace,
  document: Readonly<Record<string, unknown>>,
  limit?: number
) {
  return ensureDocumentSize(
    `${label} in snapshot ${place.snapshotId} batch ${place.batchIndex} row ${place.offset}`,
    { ...document, index: 0, snapshotId: place.snapshotId },
    limit
  );
}

/** Derives one learning-program catalog document. */
const prepareProgram = Effect.fn("contentRelease.prepareProgramRow")(function* (
  place: RowPlace,
  record: typeof LearningProgramRecordSchema.Type,
  rowJson: string
) {
  const document = {
    displayOrder: record.row.displayOrder,
    programKey: record.row.key,
    rowHash: record.rowHash,
    rowJson,
  };
  yield* sizeDocument(
    "Program catalog row",
    place,
    document,
    READ_MODEL_DOCUMENT_LIMIT
  );
  return { document, kind: "program" } satisfies PreparedRow;
});

/** Derives one localized curriculum route document and its sitemap bucket. */
const prepareCurriculum = Effect.fn("contentRelease.prepareCurriculumRow")(
  function* (
    place: RowPlace,
    record: typeof CurriculumRouteRecordSchema.Type,
    rowJson: string
  ) {
    const { row } = record;
    const document = {
      ...(row.sitemap ? { bucket: getHashBucket(record.rowHash) } : {}),
      appLocale: row.appLocale,
      ...(row.materialContextParentPath === undefined
        ? {}
        : { contextPath: row.materialContextParentPath }),
      level: row.level,
      ...(row.materialKey === undefined
        ? {}
        : { materialKey: row.materialKey }),
      nodeKey: row.nodeKey,
      order: row.order,
      ...(row.parentPath === undefined ? {} : { parentPath: row.parentPath }),
      path: row.publicPath,
      programKey: row.programKey,
      rowHash: record.rowHash,
      rowJson,
      sourcePath: row.sourcePath,
    };
    yield* sizeDocument(
      "Program curriculum row",
      place,
      document,
      READ_MODEL_DOCUMENT_LIMIT
    );
    return { document, kind: "curriculum" } satisfies PreparedRow;
  }
);

/** Derives one Quran row document and the search document of a search row. */
const prepareQuran = Effect.fn("contentRelease.prepareQuranRow")(function* (
  place: RowPlace,
  record: PublishedQuranRow["record"],
  rowJson: string
) {
  const { payload } = record;
  if (
    payload.kind === "quran-search" &&
    payload.route !== `quran/${payload.surahNumber}`
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Quran search row ${place.offset} of batch ${place.batchIndex} has a noncanonical route.`
    );
  }
  const document = {
    ...quranRowFacts(record),
    rowHash: record.rowHash,
    rowJson,
  };
  yield* sizeDocument(
    "Quran row",
    place,
    document,
    quranRowDocumentLimit(payload.kind)
  );
  if (payload.kind !== "quran-search") {
    return { document, kind: "quran" } satisfies PreparedRow;
  }
  const search = { ...quranSearchFacts(payload), rowHash: record.rowHash };
  yield* sizeDocument(
    "Quran search row",
    place,
    search,
    QURAN_SEARCH_DOCUMENT_LIMIT
  );
  return { document, kind: "quran", search } satisfies PreparedRow;
});

/** Derives one assessment row document. */
const prepareAssessment = Effect.fn("contentRelease.prepareAssessmentRow")(
  function* (place: RowPlace, record: AssessmentRecord, rowJson: string) {
    const document = {
      ...assessmentRowFacts(record.row),
      rowHash: record.rowHash,
      rowJson,
    };
    yield* sizeDocument("Assessment row", place, document);
    return { document, kind: "assessment" } satisfies PreparedRow;
  }
);

/** Derives the stored documents of one verified row in its family's table. */
export const prepareRow = Effect.fn("contentRelease.prepareSnapshotRow")(
  function* (place: RowPlace, row: ContentSnapshotRow, rowJson: string) {
    if (row.family === "program") {
      return row.record.kind === "program"
        ? yield* prepareProgram(place, row.record, rowJson)
        : yield* prepareCurriculum(place, row.record, rowJson);
    }
    if (row.family === "quran") {
      return yield* prepareQuran(place, row.record, rowJson);
    }
    return yield* prepareAssessment(place, row.record, rowJson);
  }
);

/**
 * Does every CPU step of one verified batch before its mutation: the canonical
 * row text, its bounded transport size, the batch hash a retry must match, and
 * each stored document with its derived facts and its size.
 */
const prepareSnapshotBatch = Effect.fn("contentRelease.prepareSnapshotBatch")(
  function* (request: typeof StageSnapshotBatchInputSchema.Type) {
    const { batchIndex, family, releaseId, snapshotId } = request;
    const rowJson = Arr.map(request.rows, encodeSnapshotRowJson);
    if (
      rowJson.length > MAX_SNAPSHOT_BATCH_COUNT ||
      getConvexSize({ batchIndex, family, releaseId, rowJson, snapshotId }) >
        MAX_SNAPSHOT_BATCH_BYTES
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_LIMIT",
        `Snapshot batch ${family}/${batchIndex} exceeds its bounded transport contract.`
      );
    }
    const batchHash = yield* hashBatch("snapshot", releaseId, batchIndex, [
      family,
      snapshotId,
      ...rowJson,
    ]);
    const rows = yield* Effect.forEach(
      Arr.zip(request.rows, rowJson),
      ([row, json], offset) =>
        prepareRow({ batchIndex, offset, snapshotId }, row, json)
    );
    return { batchHash, rows };
  }
);

/**
 * Reads what a batch is bound to from the stored release and snapshot
 * manifests, which never change for their ids: the signed manifest hash the
 * mutation checks, and the row counts the batch must stay within.
 */
const planSnapshotBatch = Effect.fn("contentRelease.planSnapshotBatch")(
  function* (
    family: ContentSnapshotKind,
    snapshotId: string,
    stored: typeof batchContextValidator.Type
  ) {
    const signed = yield* decodeReleaseJson(stored.releaseJson);
    const state = signed.manifest.snapshots[family];
    if (state.mode !== "replace" || state.resultSnapshotId !== snapshotId) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Release ${signed.manifest.releaseId} does not accept ${family} snapshot rows.`
      );
    }
    const manifest = yield* decodeSnapshotJson(stored.snapshotJson);
    if (
      contentSnapshotId(manifest) !== snapshotId ||
      manifest.family !== family
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Snapshot ${family}/${snapshotId} lost its manifest identity.`
      );
    }
    return {
      familyRows: state.rowCount,
      manifestHash: signed.manifestHash,
      totalRows: snapshotRowCount(signed.manifest.snapshots),
    };
  }
);

/**
 * Builds the complete staging mutation arguments of one verified batch from
 * the stored manifests it is bound to. The ingress action runs this, so the
 * mutation does no decoding, encoding, hashing, derivation or sizing.
 */
export const prepareSnapshotStage = Effect.fn(
  "contentRelease.prepareSnapshotStage"
)(function* (
  request: typeof StageSnapshotBatchInputSchema.Type,
  stored: typeof batchContextValidator.Type
) {
  const { batchIndex, family, releaseId, snapshotId } = request;
  const plan = yield* planSnapshotBatch(family, snapshotId, stored);
  const prepared = yield* prepareSnapshotBatch(request);
  return {
    ...plan,
    ...prepared,
    batchIndex,
    family,
    releaseId,
    snapshotId,
  } satisfies typeof stageBatchArgsValidator.Type;
});
