import { validateActiveRuntime } from "@repo/backend/content/snapshot/closure";
import { contentSnapshotError } from "@repo/backend/content/snapshot/error";
import {
  type JsonObject,
  stripConvexSystemFields,
} from "@repo/backend/content/snapshot/json";
import { readPublishedContentState } from "@repo/backend/content/snapshot/selection";
import {
  CONTENT_RUNTIME_TABLE_DEFINITIONS,
  type RuntimeRow,
  type RuntimeTable,
  type RuntimeTables,
} from "@repo/backend/content/snapshot/tables";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import { validate } from "convex-helpers/validators";
import { Effect, Struct } from "effect";

export type RuntimeSource = ReadonlyMap<RuntimeTable, readonly JsonObject[]>;

/** Decodes stored rows with their owning database contract, without copying schemas. */
const readRows = Effect.fn("contentRuntime.readProjectionRows")(function* <
  Table extends RuntimeTable,
>(source: RuntimeSource, table: Table) {
  const rows = source.get(table);
  if (!rows) {
    return yield* contentSnapshotError(
      `Signed runtime source is missing ${table}.`
    );
  }
  return yield* Effect.forEach(rows, (input) => {
    const row = stripConvexSystemFields(input);
    if (!validate(CONTENT_RUNTIME_TABLE_DEFINITIONS[table].validator, row)) {
      return Effect.fail(
        contentSnapshotError(
          `Signed runtime source ${table} violates its database contract.`
        )
      );
    }
    return Effect.succeed<RuntimeRow<Table>>(row);
  });
});

/** Selects MVCC winners before removing tombstones, so deleted rows never return. */
const latestRows = Effect.fn("contentRuntime.selectLatestRows")(function* <
  Row extends { readonly sequence: number },
>(rows: readonly Row[], sequence: number, identity: (row: Row) => string) {
  const selected = new Map<string, Row>();
  const duplicates = new Set<string>();
  for (const row of rows) {
    if (row.sequence > sequence) {
      continue;
    }
    const key = identity(row);
    const prior = selected.get(key);
    if (!prior || row.sequence > prior.sequence) {
      selected.set(key, row);
      duplicates.delete(key);
    } else if (row.sequence === prior.sequence) {
      duplicates.add(key);
    }
  }
  if (duplicates.size > 0) {
    return yield* contentSnapshotError(
      "Signed runtime has duplicate current MVCC identities."
    );
  }
  return [...selected.values()];
});

/** Projects one complete public build runtime, preserving all signed bytes verbatim. */
export const projectActiveRuntime = Effect.fn(
  "contentRuntime.projectActiveRuntime"
)(function* (source: RuntimeSource) {
  const state = yield* readPublishedContentState(
    yield* readRows(source, "contentState")
  );
  const contentState = [
    Struct.pick(state, [
      "key",
      "nextSequence",
      "updatedAt",
      "activeManifestHash",
      "activeReleaseId",
      "activeSequence",
      "articleManifestHash",
      "articleReleaseId",
      "articleSequence",
      "articleSlot",
      "materialManifestHash",
      "materialReleaseId",
      "materialSequence",
      "materialSlot",
      "searchManifestHash",
      "searchReleaseId",
      "searchSequence",
      "searchSlot",
    ]),
  ];
  const contentReleases = (yield* readRows(source, "contentReleases"))
    .filter((row) => row.releaseId === state.activeReleaseId)
    .map((row) =>
      Struct.omit(row, [
        "abortedAt",
        "abortedRows",
        "abortingAt",
        "cleanupAt",
        "cleanupDeletedArtifacts",
        "cleanupFutureAt",
        "cleanupHash",
        "cleanupRetryAt",
        "proofWorkflowId",
        "proofFailure",
        "completedAt",
        "proofAt",
        "proofJson",
        "receiptJson",
        "tryoutRuntimeRequired",
        "verifiedAt",
      ])
    );
  const release = contentReleases[0];
  if (contentReleases.length !== 1 || !release) {
    return yield* contentSnapshotError(
      "Signed runtime must contain exactly one active release."
    );
  }
  const signed = yield* decodeReleaseJson(release.releaseJson);
  const heads = yield* latestRows(
    yield* readRows(source, "contentHeads"),
    state.activeSequence,
    (row) => JSON.stringify([row.contentKey, row.artifactLocale])
  );
  const contentHeads = heads.filter(
    (row) => row.operation === "upsert" && row.delivery === "public"
  );
  const publicKeys = new Set(
    contentHeads.map((row) =>
      JSON.stringify([row.contentKey, row.artifactLocale])
    )
  );
  const pageKeys = new Set(
    contentHeads
      .filter((row) => row.family === "page")
      .map((row) => JSON.stringify([row.contentKey, row.artifactLocale]))
  );
  const bindings = yield* latestRows(
    yield* readRows(source, "contentBindings"),
    state.activeSequence,
    (row) => JSON.stringify([row.appLocale, row.publicPath])
  );
  const contentBindings = bindings.filter(
    (row) =>
      row.operation === "bind" &&
      publicKeys.has(JSON.stringify([row.contentKey, row.appLocale]))
  );
  const contentKeys = (yield* readRows(source, "contentKeys")).filter((row) =>
    pageKeys.has(JSON.stringify([row.contentKey, row.artifactLocale]))
  );
  const programId = signed.manifest.snapshots.program.resultSnapshotId;
  const quranId = signed.manifest.snapshots.quran.resultSnapshotId;
  const tryoutId = signed.manifest.snapshots.tryout.resultSnapshotId;
  const contentSnapshots = (yield* readRows(source, "contentSnapshots"))
    .filter(
      (row) =>
        row.snapshotId ===
        signed.manifest.snapshots[row.family].resultSnapshotId
    )
    .map((row) =>
      Struct.omit(row, [
        "cleanupAt",
        "cleanupIndex",
        "cleanupPart",
        "cleanupRetryAt",
      ])
    );
  const tryoutPlacements = (yield* readRows(source, "tryoutPlacements")).filter(
    (row) => row.snapshotId === tryoutId
  );
  const artifactHashes = new Set([
    ...contentHeads.map((row) => row.artifactHash),
    ...tryoutPlacements.flatMap((row) => [
      row.questionArtifactHash,
      row.answerArtifactHash,
    ]),
  ]);
  const tables = {
    contentState,
    contentReleases,
    contentHeads,
    contentBindings,
    contentKeys,
    contentSnapshots,
    tryoutPlacements,
    contentArtifacts: (yield* readRows(source, "contentArtifacts")).filter(
      (row) => artifactHashes.has(row.artifactHash)
    ),
    contentIndex: (yield* readRows(source, "contentIndex")).filter(
      (row) => row.slot === state.searchSlot
    ),
    articleCatalog: (yield* readRows(source, "articleCatalog")).filter(
      (row) => row.slot === state.articleSlot
    ),
    articleCategories: (yield* readRows(source, "articleCategories")).filter(
      (row) => row.slot === state.articleSlot
    ),
    articleBuckets: (yield* readRows(source, "articleBuckets")).filter(
      (row) => row.slot === state.articleSlot
    ),
    materialCatalog: (yield* readRows(source, "materialCatalog")).filter(
      (row) => row.slot === state.materialSlot
    ),
    materialBuckets: (yield* readRows(source, "materialBuckets")).filter(
      (row) => row.slot === state.materialSlot
    ),
    programCatalog: (yield* readRows(source, "programCatalog")).filter(
      (row) => row.snapshotId === programId
    ),
    curriculumRoutes: (yield* readRows(source, "curriculumRoutes")).filter(
      (row) => row.snapshotId === programId
    ),
    programBuckets: (yield* readRows(source, "programBuckets")).filter(
      (row) => row.snapshotId === programId
    ),
    quranRows: (yield* readRows(source, "quranRows")).filter(
      (row) => row.snapshotId === quranId
    ),
    quranSearch: (yield* readRows(source, "quranSearch")).filter(
      (row) => row.snapshotId === quranId
    ),
    tryoutCatalog: (yield* readRows(source, "tryoutCatalog")).filter(
      (row) => row.snapshotId === tryoutId
    ),
    tryoutRuntimeBundles: (yield* readRows(source, "tryoutRuntimeBundles"))
      .filter((row) => row.bundleHash === release.tryoutRuntimeBundleHash)
      .map((row) => Struct.omit(row, ["cleanupReleaseId"])),
  } satisfies RuntimeTables;
  yield* validateActiveRuntime(tables, state, release, signed);
  return tables;
});
