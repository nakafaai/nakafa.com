import type { ActiveAppLocale } from "@nakafa/aksara-contracts/locale";
import { compareCodeUnits } from "@nakafa/aksara-contracts/text/order";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { resolvePublicProjection } from "@repo/backend/convex/contentRelease/catalog";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { PAGE_CATALOG_LIMIT } from "@repo/backend/convex/contentRelease/page/limits";
import { loadActiveIdentity } from "@repo/backend/convex/contentRelease/runtime/active";
import { loadReleaseFamilies } from "@repo/backend/convex/contentRelease/scope/family";
import { Effect } from "effect";

interface PageCatalogRow {
  readonly contentKey: string;
  readonly projectionJson: string;
}

/** Reads every current page projection for one signed application locale. */
const readLocalePages = Effect.fn("contentRelease.readLocalePages")(function* (
  ctx: QueryCtx,
  activeSequence: number,
  appLocale: ActiveAppLocale
) {
  const keys = yield* Effect.promise(() =>
    ctx.db
      .query("contentKeys")
      .withIndex(
        "by_family_and_artifactLocale_and_createdSequence_and_contentKey",
        (index) =>
          index
            .eq("family", "page")
            .eq("artifactLocale", appLocale)
            .lte("createdSequence", activeSequence)
      )
      .take(PAGE_CATALOG_LIMIT + 1)
  );
  if (keys.length > PAGE_CATALOG_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Public page catalog for ${appLocale} exceeds ${PAGE_CATALOG_LIMIT} stable identities.`
    );
  }

  const projections = yield* Effect.forEach(keys, ({ contentKey }) =>
    resolvePublicProjection(ctx, contentKey, appLocale, activeSequence)
  );
  const rows: PageCatalogRow[] = [];
  for (const projection of projections) {
    if (projection === null) {
      continue;
    }
    rows.push({
      contentKey: projection.contentKey,
      projectionJson: projection.projectionJson,
    });
  }
  return rows.sort((left, right) =>
    compareCodeUnits(left.contentKey, right.contentKey)
  );
});

/** Checks locale parity by stable page identity, independent of public paths. */
function hasSamePageKeys(
  expected: readonly PageCatalogRow[],
  actual: readonly PageCatalogRow[]
) {
  return (
    expected.length === actual.length &&
    expected.every(
      ({ contentKey }, index) => actual[index]?.contentKey === contentKey
    )
  );
}

/** Reads the complete active signed Page catalog with locale parity proof. */
export const readPageCatalog = Effect.fn("contentRelease.readPageCatalog")(
  function* (ctx: QueryCtx) {
    const active = yield* loadActiveIdentity(ctx);
    if (!active) {
      return {
        activeReleaseId: null,
        managed: false,
        projectionJson: [],
      };
    }
    const families = yield* loadReleaseFamilies(active.release);
    if (!families.result.includes("page")) {
      return {
        activeReleaseId: active.releaseId,
        managed: false,
        projectionJson: [],
      };
    }

    const catalogs = yield* Effect.forEach(
      active.signed.manifest.activeAppLocales,
      (appLocale) => readLocalePages(ctx, active.sequence, appLocale)
    );
    const expected = catalogs[0] ?? [];
    if (
      expected.length === 0 ||
      catalogs.some((catalog) => !hasSamePageKeys(expected, catalog))
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Public pages in active release ${active.releaseId} do not have complete locale parity.`
      );
    }

    return {
      activeReleaseId: active.releaseId,
      managed: true,
      projectionJson: catalogs.flatMap((catalog) =>
        catalog.map(({ projectionJson }) => projectionJson)
      ),
    };
  }
);
