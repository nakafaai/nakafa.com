import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import { QueryCtx } from "@repo/backend/confect/_generated/services";
import type { Locale } from "@repo/backend/confect/modules/content/content.schemas";
import { getOptionalAppUser } from "@repo/backend/confect/modules/identity/auth.service";
import type { TryoutProduct } from "@repo/backend/confect/modules/tryout/products";
import { TryoutError } from "@repo/backend/confect/modules/tryout/tryout.errors";
import { loadValidatedTryoutPartSets } from "@repo/backend/confect/modules/tryout/tryoutParts.service";
import { getAll } from "convex-helpers/server/relationships";
import { Effect } from "effect";

const MAX_TRYOUT_CATALOG_PAGE_SIZE = 25;

interface PaginationOpts {
  readonly cursor: string | null;
  readonly endCursor?: string | null;
  readonly id?: number;
  readonly maximumBytesRead?: number;
  readonly maximumRowsRead?: number;
  readonly numItems: number;
}

/** Builds one public tryout catalog row. */
function buildActiveTryoutCatalogEntry(args: {
  readonly entry: Doc<"tryouts">;
  readonly latestAttempt: {
    readonly expiresAt: number;
    readonly lastActivityAt: number;
    readonly status: "completed" | "expired" | "in-progress";
  } | null;
}) {
  return {
    cycleKey: args.entry.cycleKey,
    label: args.entry.label,
    latestAttempt: args.latestAttempt
      ? {
          expiresAtMs: args.latestAttempt.expiresAt,
          status: args.latestAttempt.status,
          updatedAt: args.latestAttempt.lastActivityAt,
        }
      : null,
    partCount: args.entry.partCount,
    slug: args.entry.slug,
    totalQuestionCount: args.entry.totalQuestionCount,
    tryoutId: args.entry._id,
  };
}

/** Loads catalog rows with current user's latest attempt state when available. */
const loadActiveTryoutCatalogEntries = Effect.fn(
  "tryouts.catalog.loadActiveEntries"
)(function* (entries: readonly Doc<"tryouts">[], userId: Id<"users"> | null) {
  const ctx = yield* QueryCtx;

  if (!userId) {
    return entries.map((entry) =>
      buildActiveTryoutCatalogEntry({ entry, latestAttempt: null })
    );
  }

  const latestAttempts = yield* Effect.all(
    entries.map((entry) =>
      Effect.promise(() =>
        ctx.db
          .query("tryoutAttempts")
          .withIndex("by_userId_and_tryoutId_and_startedAt", (query) =>
            query.eq("userId", userId).eq("tryoutId", entry._id)
          )
          .order("desc")
          .first()
      )
    )
  );

  return entries.map((entry, index) =>
    buildActiveTryoutCatalogEntry({
      entry,
      latestAttempt: latestAttempts[index] ?? null,
    })
  );
});

/** Returns one paginated page of active tryout catalog rows. */
export const getActiveTryoutCatalogPage = Effect.fn(
  "tryouts.catalog.getActiveTryoutCatalogPage"
)(function* (args: {
  readonly locale: Locale;
  readonly paginationOpts: PaginationOpts;
  readonly product: TryoutProduct;
}) {
  const ctx = yield* QueryCtx;
  const paginationOpts = {
    ...args.paginationOpts,
    numItems: Math.min(
      args.paginationOpts.numItems,
      MAX_TRYOUT_CATALOG_PAGE_SIZE
    ),
  };
  const catalogPage = yield* Effect.promise(() =>
    ctx.db
      .query("tryouts")
      .withIndex(
        "by_product_and_locale_and_isActive_and_catalogPosition",
        (query) =>
          query
            .eq("product", args.product)
            .eq("locale", args.locale)
            .eq("isActive", true)
      )
      .paginate(paginationOpts)
  );
  const user = yield* getOptionalAppUser(ctx);
  const page = yield* loadActiveTryoutCatalogEntries(
    catalogPage.page,
    user?.appUser._id ?? null
  );

  return { ...catalogPage, page };
});

/** Loads active catalog rows and count with optional user attempt state. */
const loadActiveTryoutCatalogSnapshot = Effect.fn(
  "tryouts.catalog.loadActiveTryoutCatalogSnapshot"
)(function* (
  args: {
    readonly locale: Locale;
    readonly pageSize?: number;
    readonly product: TryoutProduct;
  },
  userId: Id<"users"> | null
) {
  const ctx = yield* QueryCtx;
  const pageSize = Math.max(
    0,
    Math.min(
      args.pageSize ?? MAX_TRYOUT_CATALOG_PAGE_SIZE,
      MAX_TRYOUT_CATALOG_PAGE_SIZE
    )
  );
  const catalogEntries = yield* Effect.promise(() =>
    ctx.db
      .query("tryouts")
      .withIndex(
        "by_product_and_locale_and_isActive_and_catalogPosition",
        (query) =>
          query
            .eq("product", args.product)
            .eq("locale", args.locale)
            .eq("isActive", true)
      )
      .take(pageSize)
  );
  const catalogMeta = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutCatalogMeta")
      .withIndex("by_product_and_locale", (query) =>
        query.eq("product", args.product).eq("locale", args.locale)
      )
      .unique()
  );
  const initialPage = yield* loadActiveTryoutCatalogEntries(
    catalogEntries,
    userId
  );

  return {
    activeCount: catalogMeta?.activeCount ?? 0,
    initialPage,
  };
});

/** Returns the active tryout catalog count and initial rows. */
export const getActiveTryoutCatalogSnapshot = Effect.fn(
  "tryouts.catalog.getActiveTryoutCatalogSnapshot"
)(function* (args: {
  readonly locale: Locale;
  readonly pageSize?: number;
  readonly product: TryoutProduct;
}) {
  const ctx = yield* QueryCtx;
  const user = yield* getOptionalAppUser(ctx);
  return yield* loadActiveTryoutCatalogSnapshot(
    args,
    user?.appUser._id ?? null
  );
});

/** Returns the non-personalized active tryout catalog snapshot. */
export const getPublicActiveTryoutCatalogSnapshot = Effect.fn(
  "tryouts.catalog.getPublicActiveTryoutCatalogSnapshot"
)(function* (args: {
  readonly locale: Locale;
  readonly pageSize?: number;
  readonly product: TryoutProduct;
}) {
  return yield* loadActiveTryoutCatalogSnapshot(args, null);
});

/** Returns details and part metadata for one tryout. */
export const getTryoutDetails = Effect.fn("tryouts.catalog.getTryoutDetails")(
  function* (args: {
    readonly locale: Locale;
    readonly product: TryoutProduct;
    readonly slug: string;
  }) {
    const ctx = yield* QueryCtx;
    const tryout = yield* Effect.promise(() =>
      ctx.db
        .query("tryouts")
        .withIndex("by_product_and_locale_and_slug", (query) =>
          query
            .eq("product", args.product)
            .eq("locale", args.locale)
            .eq("slug", args.slug)
        )
        .unique()
    );

    if (!tryout) {
      return null;
    }

    const tryoutPartSets = yield* loadValidatedTryoutPartSets(ctx.db, {
      partCount: tryout.partCount,
      tryoutId: tryout._id,
    });
    const sets = yield* Effect.promise(() =>
      getAll(
        ctx.db,
        "exerciseSets",
        tryoutPartSets.map((partSet) => partSet.setId)
      )
    );
    const parts = yield* Effect.all(
      tryoutPartSets.map((partSet, index) => {
        const set = sets[index];

        if (!set) {
          return Effect.fail(
            new TryoutError({
              code: "INVALID_TRYOUT_STATE",
              message: "Tryout is missing one of its part sets.",
            })
          );
        }

        return Effect.succeed({
          material: set.material,
          partIndex: partSet.partIndex,
          partKey: partSet.partKey,
          questionCount: set.questionCount,
          setId: partSet.setId,
          setSlug: set.slug,
        });
      })
    );

    return { parts, tryout };
  }
);
