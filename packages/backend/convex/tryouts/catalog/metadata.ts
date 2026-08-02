import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { TryoutCatalogRow } from "@nakafa/aksara-contracts/tryout/spec";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { loadTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/catalog";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { locales } from "@repo/utilities/locales";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";
import { Effect } from "effect";

export const tryoutMetadataArgsValidator = {
  kind: literals("country", "exam", "track", "set", "section"),
  locale: localeValidator,
  publicPath: v.string(),
};

const tryoutAlternateValidator = v.object({
  locale: localeValidator,
  publicPath: v.string(),
});

export const tryoutMetadataReturnValidator = v.object({
  managed: v.boolean(),
  route: v.union(
    v.null(),
    v.object({
      alternates: v.array(tryoutAlternateValidator),
      description: v.optional(v.string()),
      publicPath: v.string(),
      title: v.string(),
    })
  ),
});

type TryoutRouteKind = TryoutCatalogRow["kind"];

interface TryoutMetadataInput {
  readonly kind: TryoutRouteKind;
  readonly locale: (typeof locales)[number];
  readonly publicPath: string;
}

/** Reads one route and its localized counterparts from signed ownership. */
export const readTryoutMetadata = Effect.fn("tryouts.catalog.readMetadata")(
  function* (ctx: QueryCtx, input: TryoutMetadataInput) {
    const currentCatalog = yield* loadTryoutCatalog(ctx, input.locale);
    if (!currentCatalog.managed) {
      return { managed: false, route: null };
    }

    const current = findRoute(
      currentCatalog.entries.map(({ row }) => row),
      input.kind,
      input.publicPath
    );
    if (!current?.publicPath) {
      return { managed: true, route: null };
    }
    const currentPublicPath = current.publicPath;

    const otherCatalogs = yield* Effect.forEach(
      locales.filter((locale) => locale !== input.locale),
      (locale) => loadTryoutCatalog(ctx, locale)
    );
    const routeIdentity = getLocaleIndependentIdentity(current);
    const alternates = [currentCatalog, ...otherCatalogs].flatMap((catalog) => {
      const alternate = catalog.entries
        .map(({ row }) => row)
        .find(
          (row) =>
            getLocaleIndependentIdentity(row) === routeIdentity &&
            row.publicPath !== undefined
        );

      return alternate?.publicPath
        ? [{ locale: alternate.locale, publicPath: alternate.publicPath }]
        : [];
    });

    return {
      managed: true,
      route: {
        alternates,
        description: current.description,
        publicPath: currentPublicPath,
        title: current.title,
      },
    };
  }
);

/** Finds one exact public hierarchy row without accepting internal sections. */
function findRoute(
  rows: readonly TryoutCatalogRow[],
  kind: TryoutRouteKind,
  publicPath: string
) {
  return rows.find((row) => row.kind === kind && row.publicPath === publicPath);
}

/** Derives the stable hierarchy identity while deliberately ignoring locale. */
function getLocaleIndependentIdentity(row: TryoutCatalogRow) {
  return tryoutCatalogIdentity({ ...row, locale: locales[0] });
}
