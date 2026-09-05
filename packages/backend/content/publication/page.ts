import type { ActiveAppLocale } from "@nakafa/aksara-contracts/locale";
import { compareCodeUnits } from "@nakafa/aksara-contracts/text/order";
import { resolvePublicProjection } from "@repo/backend/content/publication/projection";
import { loadActiveIdentity } from "@repo/backend/content/publication/read";
import { PublicationSource } from "@repo/backend/content/publication/source";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { PAGE_CATALOG_LIMIT } from "@repo/backend/convex/contentRelease/page/limits";
import { loadReleaseFamilies } from "@repo/backend/convex/contentRelease/scope/family";
import { Array as Arr, Effect } from "effect";

interface PageCatalogRow {
  readonly contentKey: string;
  readonly projectionJson: string;
}

/** Reads every current page projection for one signed application locale. */
const readLocalePages = Effect.fn("contentRelease.readLocalePages")(function* (
  activeSequence: number,
  appLocale: ActiveAppLocale
) {
  const keys = yield* (yield* PublicationSource).pageKeys(
    appLocale,
    activeSequence,
    PAGE_CATALOG_LIMIT + 1
  );
  if (keys.length > PAGE_CATALOG_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Public page catalog for ${appLocale} exceeds ${PAGE_CATALOG_LIMIT} stable identities.`
    );
  }

  const projections = yield* Effect.forEach(keys, ({ contentKey }) =>
    resolvePublicProjection(contentKey, appLocale, activeSequence)
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

/** Checks locale parity by the content key that the Page contract binds to pageKey. */
function hasSamePageIdentities(
  expected: readonly PageCatalogRow[],
  actual: readonly PageCatalogRow[]
) {
  return (
    expected.length === actual.length &&
    Arr.zip(expected, actual).every(
      ([left, right]) => left.contentKey === right.contentKey
    )
  );
}

/** Reads the complete active signed Page catalog with locale parity proof. */
export const readPageCatalog = Effect.fn("contentRelease.readPageCatalog")(
  function* () {
    const active = yield* loadActiveIdentity();
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
      (appLocale) => readLocalePages(active.sequence, appLocale)
    );
    const expected = yield* Effect.fromNullishOr(catalogs[0]).pipe(
      Effect.orDie
    );
    if (
      expected.length === 0 ||
      catalogs.some((catalog) => !hasSamePageIdentities(expected, catalog))
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
