import type { ContentLocale } from "@nakafa/aksara-contracts/content";
import type { TryoutCatalogCounts } from "@nakafa/aksara-contracts/tryout/snapshot";
import type { TryoutCatalogRow } from "@nakafa/aksara-contracts/tryout/spec";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { readSourceRevision } from "@repo/backend/convex/contentRelease/runtime/origin";
import { TRYOUT_CATALOG_LIMIT } from "@repo/backend/convex/contentRelease/tryout/limits";
import { loadTryoutOwner } from "@repo/backend/convex/contentRelease/tryout/owner";
import { verifyTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/verify";
import { Effect } from "effect";

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

/** Loads the complete verified hierarchy for one active try-out locale. */
export const loadTryoutCatalog = Effect.fn("contentRelease.loadTryoutCatalog")(
  function* (ctx: QueryCtx, locale: ContentLocale) {
    const owner = yield* loadTryoutOwner(ctx);
    if (!(owner.managed && owner.selected)) {
      return {
        activeManifestHash: owner.selected?.active.manifestHash ?? null,
        activeReleaseId: owner.selected?.active.releaseId ?? null,
        managed: false,
        entries: [],
        snapshotId: owner.selected?.snapshotId ?? null,
        sourceRevision: null,
      };
    }
    const { active, snapshot, snapshotId } = owner.selected;
    if (snapshot.family !== "tryout") {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Active try-out owner selected another snapshot family."
      );
    }
    const { counts, locales } = snapshot.manifest;
    const expected = localizedCounts(counts, locales.length);
    if (!expected) {
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
        .withIndex("by_snapshotId_and_locale_and_publicPath", (index) =>
          index.eq("snapshotId", snapshotId).eq("locale", locale)
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
      verifyTryoutCatalog(storedRow, snapshotId).pipe(
        Effect.map((row) => ({
          row,
          rowHash: storedRow.rowHash,
          rowJson: storedRow.rowJson,
        }))
      )
    );
    const rows = entries.map(({ row }) => row);
    if (JSON.stringify(countCatalog(rows)) !== JSON.stringify(expected)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Try-out catalog for ${locale} changed its hierarchy counts.`
      );
    }
    return {
      activeManifestHash: active.manifestHash,
      activeReleaseId: active.releaseId,
      entries,
      managed: true,
      snapshotId,
      sourceRevision: readSourceRevision(active),
    };
  }
);

/** Reads the canonical wire rows used by release diagnostics and previews. */
export const readTryoutCatalog = Effect.fn("contentRelease.readTryoutCatalog")(
  function* (ctx: QueryCtx, locale: ContentLocale) {
    const catalog = yield* loadTryoutCatalog(ctx, locale);
    return {
      activeManifestHash: catalog.activeManifestHash,
      activeReleaseId: catalog.activeReleaseId,
      managed: catalog.managed,
      rowJson: catalog.entries.map(({ rowJson }) => rowJson),
      snapshotId: catalog.snapshotId,
      sourceRevision: catalog.sourceRevision,
    };
  }
);
