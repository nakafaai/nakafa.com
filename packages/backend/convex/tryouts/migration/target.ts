"use node";

import {
  hashTryoutHistoryMigrationMap,
  TryoutHistoryMigrationMapEntrySchema,
} from "@nakafa/aksara-contracts/migration/tryout/history/map";
import type { TryoutHistoryMigrationTargetEvidence } from "@nakafa/aksara-contracts/migration/tryout/history/spec";
import type { ContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import { digestTryoutCatalog } from "@nakafa/aksara-contracts/tryout/catalog-hash";
import {
  tryoutCatalogIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import { digestTryoutPlacements } from "@nakafa/aksara-contracts/tryout/placement-hash";
import { makeTryoutSnapshot } from "@nakafa/aksara-contracts/tryout/snapshot/hash";
import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import { verifySnapshotBatch } from "@repo/backend/convex/contentRelease/ingress/snapshot";
import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import { loadMigrationTargetRuntime } from "@repo/backend/convex/tryouts/migration/bundle";
import { verifyTargetArtifactClosure } from "@repo/backend/convex/tryouts/migration/closure";
import type { mapEntryValidator } from "@repo/backend/convex/tryouts/migration/state/schema";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { Effect, Schema, Stream } from "effect";

type MapEntry = Infer<typeof mapEntryValidator>;
interface StoredTargetRow {
  readonly index: number;
  readonly rowHash: string;
  readonly rowJson: string;
}

const mapEntriesReference = makeFunctionReference<
  "query",
  { migrationId: string },
  MapEntry[]
>("tryouts/migration/state/query:mapEntries");
const targetRowsReference = makeFunctionReference<
  "query",
  { migrationId: string; rowKind: "catalog" | "placement" },
  StoredTargetRow[]
>("tryouts/migration/state/query:targetRows");

/** Reads and authenticates one complete target row kind in source index order. */
const loadTargetRows = Effect.fn("tryouts.migration.loadTargetRows")(function* (
  ctx: Pick<ActionCtx, "runQuery">,
  migrationId: string,
  rowKind: "catalog" | "placement"
) {
  const stored = yield* callInternal(() =>
    ctx.runQuery(targetRowsReference, { migrationId, rowKind })
  );
  const rows = yield* Effect.forEach(stored, (storedRow) =>
    decodeSnapshotRowJson(storedRow.rowJson).pipe(
      Effect.flatMap((row) => {
        if (
          row.family !== "tryout" ||
          row.rowKind !== rowKind ||
          row.record.rowHash !== storedRow.rowHash
        ) {
          return releaseFail(
            "CONTENT_RELEASE_INTEGRITY",
            "Converted try-out row changed its stored identity."
          );
        }
        return Effect.succeed({ index: storedRow.index, row });
      })
    )
  );
  yield* verifySnapshotBatch(
    "tryout",
    (yield* loadMigrationTargetRuntime(ctx, migrationId)).bundle.payload
      .snapshot.snapshotId,
    rows.map(({ row }) => row)
  );
  return rows;
});

/** Checks map order, target row identity, and artifact closure. */
const verifyMappings = Effect.fn("tryouts.migration.verifyTargetMappings")(
  function* (
    entries: readonly MapEntry[],
    catalog: readonly Extract<
      ContentSnapshotRow,
      { readonly family: "tryout"; readonly rowKind: "catalog" }
    >[],
    placements: readonly Extract<
      ContentSnapshotRow,
      { readonly family: "tryout"; readonly rowKind: "placement" }
    >[]
  ) {
    const groups = {
      artifact: entries.filter(({ kind }) => kind === "artifact"),
      catalog: entries.filter(({ kind }) => kind === "catalog"),
      placement: entries.filter(({ kind }) => kind === "placement"),
    };
    const catalogByIndex = new Map(
      catalog.map((row, index) => [index, row.record])
    );
    const placementByIndex = new Map(
      placements.map((row, offset) => [catalog.length + offset, row.record])
    );
    const referencedArtifacts = new Set<string>(
      placements.flatMap(({ record }) => [
        record.row.questionArtifactHash,
        record.row.answerArtifactHash,
      ])
    );
    const mapsMatch =
      groups.artifact.every(
        (entry, index) =>
          entry.index === index && referencedArtifacts.has(entry.newHash)
      ) &&
      groups.catalog.every((entry) => {
        const record = catalogByIndex.get(entry.index);
        return (
          record?.rowHash === entry.newHash &&
          tryoutCatalogIdentity(record.row) === entry.identity
        );
      }) &&
      groups.placement.every((entry) => {
        const record = placementByIndex.get(entry.index);
        return (
          record?.rowHash === entry.newHash &&
          tryoutPlacementIdentity(record.row) === entry.identity
        );
      }) &&
      new Set(groups.artifact.map(({ newHash }) => newHash)).size ===
        referencedArtifacts.size &&
      [...referencedArtifacts].every((hash) =>
        groups.artifact.some(({ newHash }) => newHash === hash)
      );
    if (!mapsMatch) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Converted try-out maps do not close over their target rows."
      );
    }
    return yield* Effect.all({
      artifacts: hashMap(groups.artifact),
      catalog: hashMap(groups.catalog),
      placements: hashMap(groups.placement),
    });
  }
);

/** Hashes one map in its already-verified source index order. */
const hashMap = Effect.fn("tryouts.migration.hashTargetMap")(
  (entries: readonly MapEntry[]) =>
    Effect.gen(function* () {
      const decoded = yield* Schema.decodeEffect(
        Schema.Array(TryoutHistoryMigrationMapEntrySchema)
      )(entries, { onExcessProperty: "error" });
      const digest = yield* hashTryoutHistoryMigrationMap(decoded);
      return { count: decoded.length, digest };
    }).pipe(Effect.mapError(contractFailure))
);

/** Recomputes the complete converted target from immutable staged storage. */
export const computeMigrationTarget = Effect.fn(
  "tryouts.migration.computeTargetEvidence"
)(function* (ctx: Pick<ActionCtx, "runQuery">, migrationId: string) {
  const runtime = yield* loadMigrationTargetRuntime(ctx, migrationId);
  const {
    catalog: catalogStored,
    maps,
    placements: placementStored,
  } = yield* Effect.all({
    catalog: loadTargetRows(ctx, migrationId, "catalog"),
    maps: callInternal(() =>
      ctx.runQuery(mapEntriesReference, { migrationId })
    ),
    placements: loadTargetRows(ctx, migrationId, "placement"),
  });
  const catalog = yield* Effect.forEach(catalogStored, ({ index, row }) => {
    if (row.rowKind !== "catalog") {
      return releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Converted try-out catalog query returned a placement."
      );
    }
    return Effect.succeed({ index, row });
  });
  const placements = yield* Effect.forEach(
    placementStored,
    ({ index, row }) => {
      if (row.rowKind !== "placement") {
        return releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          "Converted try-out placement query returned catalog metadata."
        );
      }
      return Effect.succeed({ index, row });
    }
  );
  const expectedCatalogIndices = catalogStored.every(
    ({ index }, offset) => index === offset
  );
  const expectedPlacementIndices = placementStored.every(
    ({ index }, offset) => index === catalog.length + offset
  );
  if (!(expectedCatalogIndices && expectedPlacementIndices)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Converted try-out target row indices are not contiguous."
    );
  }
  const catalogRows = catalog.map(({ row }) => row);
  const placementRows = placements.map(({ row }) => row);
  yield* verifyTargetArtifactClosure(
    ctx,
    migrationId,
    maps,
    placementRows,
    runtime.rendererManifest
  );
  const [catalogDigest, placementDigest, mapEvidence] = yield* Effect.all([
    digestTryoutCatalog(
      Stream.fromIterable(catalogRows.map(({ record }) => record))
    ),
    digestTryoutPlacements(
      Stream.fromIterable(placementRows.map(({ record }) => record))
    ),
    verifyMappings(maps, catalogRows, placementRows),
  ]);
  const counts = { country: 0, exam: 0, section: 0, set: 0, track: 0 };
  let routeCount = 0;
  const locales = new Set<string>();
  for (const { record } of catalogRows) {
    counts[record.row.kind] += 1;
    locales.add(record.row.appLocale);
    if (record.row.publicPath !== undefined) {
      routeCount += 1;
    }
  }
  const expectedLocales = runtime.bundle.payload.snapshot.activeAppLocales;
  if (
    locales.size !== expectedLocales.length ||
    expectedLocales.some((locale) => !locales.has(locale))
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Converted try-out target locale closure is incomplete."
    );
  }
  const snapshot = makeTryoutSnapshot({
    activeAppLocales: expectedLocales,
    catalogDigest: catalogDigest.digest,
    counts,
    placementCount: placementDigest.count,
    placementDigest: placementDigest.digest,
    routeCount,
  });
  if (
    JSON.stringify(snapshot) !== JSON.stringify(runtime.bundle.payload.snapshot)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Converted try-out rows do not reproduce their signed snapshot."
    );
  }
  return {
    artifacts: mapEvidence.artifacts,
    bundleHash: runtime.bundle.bundleHash,
    catalog: mapEvidence.catalog,
    placements: mapEvidence.placements,
    snapshot,
  } satisfies TryoutHistoryMigrationTargetEvidence;
});
