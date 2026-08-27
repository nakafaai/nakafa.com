import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { ContentSnapshotManifest } from "@nakafa/aksara-contracts/release/snapshot/data";
import type { TryoutCatalogRow } from "@nakafa/aksara-contracts/tryout/catalog";
import type { TryoutCatalogCounts } from "@nakafa/aksara-contracts/tryout/snapshot/spec";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { readSourceRevision } from "@repo/backend/convex/contentRelease/runtime/origin";
import { loadVerifiedSnapshot } from "@repo/backend/convex/contentRelease/runtime/snapshot";
import { TRYOUT_CATALOG_LIMIT } from "@repo/backend/convex/contentRelease/tryout/limits";
import { findTryoutOwner } from "@repo/backend/convex/contentRelease/tryout/owner";
import { verifyTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/verify";
import { Effect, Option } from "effect";

/** Counts each hierarchy kind in one verified localized catalog. */
function countCatalog(rows: readonly TryoutCatalogRow[]) {
  return {
    country: rows.filter(({ kind }) => kind === "country").length,
    exam: rows.filter(({ kind }) => kind === "exam").length,
    section: rows.filter(({ kind }) => kind === "section").length,
    set: rows.filter(({ kind }) => kind === "set").length,
    track: rows.filter(({ kind }) => kind === "track").length,
  };
}

/** Divides signed global counts into the exact expected locale inventory. */
function localizedCounts(
  counts: TryoutCatalogCounts,
  localeCount: number
): TryoutCatalogCounts | undefined {
  const entries = Object.entries(counts);
  if (entries.some(([, count]) => count % localeCount !== 0)) {
    return;
  }
  return {
    country: counts.country / localeCount,
    exam: counts.exam / localeCount,
    section: counts.section / localeCount,
    set: counts.set / localeCount,
    track: counts.track / localeCount,
  };
}

/** Divides one signed global count into the exact expected locale inventory. */
function localizedCount(count: number, localeCount: number) {
  if (count % localeCount !== 0) {
    return;
  }
  return count / localeCount;
}

/** Checks the five signed hierarchy counts without relying on key order. */
function hasExpectedCounts(
  actual: TryoutCatalogCounts,
  expected: TryoutCatalogCounts
) {
  return (
    actual.country === expected.country &&
    actual.exam === expected.exam &&
    actual.section === expected.section &&
    actual.set === expected.set &&
    actual.track === expected.track
  );
}

/** Finds the complete verified hierarchy when signed try-out is active. */
export const findTryoutCatalog = Effect.fn("contentRelease.findTryoutCatalog")(
  function* (ctx: QueryCtx, locale: AppLocaleCode) {
    const owner = yield* findTryoutOwner(ctx);
    if (Option.isNone(owner)) {
      return Option.none();
    }

    const { active, snapshot, snapshotId } = owner.value;
    const catalog = yield* loadStoredTryoutCatalog(ctx, locale, {
      activeManifestHash: active.manifestHash,
      activeReleaseId: active.releaseId,
      bundleHash: active.release.tryoutRuntimeBundleHash ?? null,
      snapshot,
      snapshotId,
      sourceRevision: readSourceRevision(active),
    });
    return Option.some(catalog);
  }
);

/** Loads the complete verified hierarchy for one active try-out locale. */
export const loadTryoutCatalog = Effect.fn("contentRelease.loadTryoutCatalog")(
  function* (ctx: QueryCtx, locale: AppLocaleCode) {
    const catalog = yield* findTryoutCatalog(ctx, locale);
    if (Option.isSome(catalog)) {
      return catalog.value;
    }

    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      "The active signed try-out snapshot is unavailable."
    );
  }
);

/** Loads one retained signed catalog for an authenticated frozen attempt. */
export const loadTryoutSnapshotCatalog = Effect.fn(
  "contentRelease.loadTryoutSnapshotCatalog"
)(function* (ctx: QueryCtx, locale: AppLocaleCode, snapshotId: string) {
  const { snapshot } = yield* loadVerifiedSnapshot(ctx, "tryout", snapshotId);
  return yield* loadStoredTryoutCatalog(ctx, locale, {
    activeManifestHash: null,
    activeReleaseId: null,
    bundleHash: null,
    snapshot,
    snapshotId,
    sourceRevision: null,
  });
});

/** Verifies every stored row and signed count for one selected snapshot. */
const loadStoredTryoutCatalog = Effect.fn(
  "contentRelease.loadStoredTryoutCatalog"
)(function* (
  ctx: QueryCtx,
  locale: AppLocaleCode,
  selection: {
    readonly activeManifestHash: string | null;
    readonly activeReleaseId: string | null;
    readonly bundleHash: string | null;
    readonly snapshot: ContentSnapshotManifest;
    readonly snapshotId: string;
    readonly sourceRevision: string | null;
  }
) {
  if (selection.snapshot.family !== "tryout") {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Selected try-out owner contains another snapshot family."
    );
  }
  const { activeAppLocales, counts, routeCount } = selection.snapshot.manifest;
  const expected = localizedCounts(counts, activeAppLocales.length);
  const expectedRouteCount = localizedCount(
    routeCount,
    activeAppLocales.length
  );
  if (!(expected && expectedRouteCount !== undefined)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Active try-out catalog counts do not divide across its locales."
    );
  }
  const total = Object.values(expected).reduce(
    (count, value) => count + value,
    0
  );
  if (total > TRYOUT_CATALOG_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Try-out catalog exceeds ${TRYOUT_CATALOG_LIMIT} rows per locale.`
    );
  }
  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutCatalog")
      .withIndex("by_snapshotId_and_appLocale_and_publicPath", (index) =>
        index.eq("snapshotId", selection.snapshotId).eq("appLocale", locale)
      )
      .take(total + 1)
  );
  if (stored.length !== total) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Try-out catalog for ${locale} does not match its signed count.`
    );
  }
  const entries = yield* Effect.forEach(stored, (storedRow) =>
    verifyTryoutCatalog(storedRow, selection.snapshotId).pipe(
      Effect.map((row) => ({
        index: storedRow.index,
        row,
        rowHash: storedRow.rowHash,
        rowJson: storedRow.rowJson,
      }))
    )
  );
  const rows = entries.map(({ row }) => row);
  if (!hasExpectedCounts(countCatalog(rows), expected)) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Try-out catalog for ${locale} changed its hierarchy counts.`
    );
  }
  const actualRouteCount = rows.filter(
    ({ publicPath }) => publicPath !== undefined
  ).length;
  if (actualRouteCount !== expectedRouteCount) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Try-out catalog for ${locale} changed its public route count.`
    );
  }
  return {
    activeManifestHash: selection.activeManifestHash,
    activeReleaseId: selection.activeReleaseId,
    bundleHash: selection.bundleHash,
    entries,
    routeCount: actualRouteCount,
    snapshotId: selection.snapshotId,
    sourceRevision: selection.sourceRevision,
  };
});

/** Reads the canonical wire rows used by release diagnostics and previews. */
export const readTryoutCatalog = Effect.fn("contentRelease.readTryoutCatalog")(
  function* (ctx: QueryCtx, locale: AppLocaleCode) {
    const catalog = yield* loadTryoutCatalog(ctx, locale);
    return {
      activeManifestHash: catalog.activeManifestHash,
      activeReleaseId: catalog.activeReleaseId,
      rowJson: catalog.entries.map(({ rowJson }) => rowJson),
      snapshotId: catalog.snapshotId,
      sourceRevision: catalog.sourceRevision,
    };
  }
);
