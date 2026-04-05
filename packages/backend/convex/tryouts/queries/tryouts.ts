import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { query } from "@repo/backend/convex/_generated/server";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { loadValidatedTryoutPartSets } from "@repo/backend/convex/tryouts/helpers/parts";
import { tryoutProductValidator } from "@repo/backend/convex/tryouts/products";
import { tryoutPartKeyValidator } from "@repo/backend/convex/tryouts/schema";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import { getAll } from "convex-helpers/server/relationships";

const MAX_TRYOUT_CATALOG_PAGE_SIZE = 25;

const tryoutCatalogLatestAttemptValidator = v.union(
  v.object({
    expiresAtMs: vv.doc("tryoutAttempts").fields.expiresAt,
    status: vv.doc("tryoutAttempts").fields.status,
    updatedAt: vv.doc("tryoutAttempts").fields.lastActivityAt,
  }),
  v.null()
);

const activeTryoutCatalogEntryValidator = v.object({
  cycleKey: vv.doc("tryoutCatalogEntries").fields.cycleKey,
  label: vv.doc("tryoutCatalogEntries").fields.label,
  latestAttempt: tryoutCatalogLatestAttemptValidator,
  partCount: vv.doc("tryoutCatalogEntries").fields.partCount,
  slug: vv.doc("tryoutCatalogEntries").fields.slug,
  totalQuestionCount: vv.doc("tryoutCatalogEntries").fields.totalQuestionCount,
  tryoutId: vv.doc("tryoutCatalogEntries").fields.tryoutId,
});

const activeTryoutCatalogSnapshotValidator = v.object({
  activeCount: v.number(),
  initialPage: v.array(activeTryoutCatalogEntryValidator),
});

type ActiveTryoutCatalogEntryRecord = Pick<
  Doc<"tryoutCatalogEntries">,
  | "cycleKey"
  | "label"
  | "partCount"
  | "slug"
  | "totalQuestionCount"
  | "tryoutId"
>;
type ActiveTryoutLatestAttempt = Pick<
  Doc<"tryoutAttempts">,
  "expiresAt" | "lastActivityAt" | "status"
>;

/** Maps one catalog row and optional latest attempt into the frontend shape. */
function buildActiveTryoutCatalogEntry({
  entry,
  latestAttempt,
}: {
  entry: ActiveTryoutCatalogEntryRecord;
  latestAttempt: ActiveTryoutLatestAttempt | null;
}) {
  return {
    cycleKey: entry.cycleKey,
    label: entry.label,
    latestAttempt: latestAttempt
      ? {
          expiresAtMs: latestAttempt.expiresAt,
          status: latestAttempt.status,
          updatedAt: latestAttempt.lastActivityAt,
        }
      : null,
    partCount: entry.partCount,
    slug: entry.slug,
    totalQuestionCount: entry.totalQuestionCount,
    tryoutId: entry.tryoutId,
  };
}

/** Loads the latest attempt rows for one bounded catalog page and optional user. */
async function loadActiveTryoutCatalogEntries(
  ctx: QueryCtx,
  {
    entries,
    userId,
  }: {
    entries: ActiveTryoutCatalogEntryRecord[];
    userId: Id<"users"> | null;
  }
) {
  if (!userId) {
    return entries.map((entry) =>
      buildActiveTryoutCatalogEntry({
        entry,
        latestAttempt: null,
      })
    );
  }

  const latestAttempts = await Promise.all(
    entries.map((entry) => {
      return ctx.db
        .query("tryoutAttempts")
        .withIndex("by_userId_and_tryoutId_and_startedAt", (q) =>
          q.eq("userId", userId).eq("tryoutId", entry.tryoutId)
        )
        .order("desc")
        .first();
    })
  );

  return entries.map((entry, index) => {
    return buildActiveTryoutCatalogEntry({
      entry,
      latestAttempt: latestAttempts[index]
        ? {
            expiresAt: latestAttempts[index].expiresAt,
            lastActivityAt: latestAttempts[index].lastActivityAt,
            status: latestAttempts[index].status,
          }
        : null,
    });
  });
}

/** Returns one ordered page of active tryout catalog rows with page-local latest badges. */
export const getActiveTryoutCatalogPage = query({
  args: {
    paginationOpts: paginationOptsValidator,
    product: tryoutProductValidator,
    locale: localeValidator,
  },
  returns: paginationResultValidator(activeTryoutCatalogEntryValidator),
  handler: async (ctx, args) => {
    const paginationOpts = {
      ...args.paginationOpts,
      numItems: Math.min(
        args.paginationOpts.numItems,
        MAX_TRYOUT_CATALOG_PAGE_SIZE
      ),
    };
    const [catalogPage, user] = await Promise.all([
      ctx.db
        .query("tryoutCatalogEntries")
        .withIndex(
          "by_product_and_locale_and_isActive_and_catalogSortKey",
          (q) =>
            q
              .eq("product", args.product)
              .eq("locale", args.locale)
              .eq("isActive", true)
        )
        .paginate(paginationOpts),
      getOptionalAppUser(ctx),
    ]);

    return {
      ...catalogPage,
      page: await loadActiveTryoutCatalogEntries(ctx, {
        entries: catalogPage.page,
        userId: user?.appUser._id ?? null,
      }),
    };
  },
});

/**
 * Returns the exact active count plus the first catalog page in one consistent
 * query for SSR entry pages.
 */
export const getActiveTryoutCatalogSnapshot = query({
  args: {
    locale: localeValidator,
    pageSize: v.optional(v.number()),
    product: tryoutProductValidator,
  },
  returns: activeTryoutCatalogSnapshotValidator,
  handler: async (ctx, args) => {
    const pageSize = Math.max(
      0,
      Math.min(
        args.pageSize ?? MAX_TRYOUT_CATALOG_PAGE_SIZE,
        MAX_TRYOUT_CATALOG_PAGE_SIZE
      )
    );
    const [catalogEntries, catalogMeta, user] = await Promise.all([
      ctx.db
        .query("tryoutCatalogEntries")
        .withIndex(
          "by_product_and_locale_and_isActive_and_catalogSortKey",
          (q) =>
            q
              .eq("product", args.product)
              .eq("locale", args.locale)
              .eq("isActive", true)
        )
        .take(pageSize),
      ctx.db
        .query("tryoutCatalogMeta")
        .withIndex("by_product_and_locale", (q) =>
          q.eq("product", args.product).eq("locale", args.locale)
        )
        .unique(),
      getOptionalAppUser(ctx),
    ]);

    return {
      activeCount: catalogMeta?.activeCount ?? 0,
      initialPage: await loadActiveTryoutCatalogEntries(ctx, {
        entries: catalogEntries,
        userId: user?.appUser._id ?? null,
      }),
    };
  },
});

/** Loads one tryout plus its ordered part-set metadata. */
export const getTryoutDetails = query({
  args: {
    product: tryoutProductValidator,
    locale: localeValidator,
    slug: v.string(),
  },
  returns: vv.nullable(
    v.object({
      tryout: vv.doc("tryouts"),
      parts: v.array(
        v.object({
          partIndex: v.number(),
          partKey: tryoutPartKeyValidator,
          setId: vv.id("exerciseSets"),
          setSlug: vv.doc("exerciseSets").fields.slug,
          material: v.string(),
          questionCount: v.number(),
        })
      ),
    })
  ),
  handler: async (ctx, args) => {
    const tryout = await ctx.db
      .query("tryouts")
      .withIndex("by_product_and_locale_and_slug", (q) =>
        q
          .eq("product", args.product)
          .eq("locale", args.locale)
          .eq("slug", args.slug)
      )
      .unique();

    if (!tryout) {
      return null;
    }

    const tryoutPartSets = await loadValidatedTryoutPartSets(ctx.db, {
      partCount: tryout.partCount,
      tryoutId: tryout._id,
    });

    const sets = await getAll(
      ctx.db,
      "exerciseSets",
      tryoutPartSets.map((partSet) => partSet.setId)
    );

    const parts = tryoutPartSets.map((partSet, index) => {
      const set = sets[index];

      if (!set) {
        throw new ConvexError({
          code: "INVALID_TRYOUT_STATE",
          message: "Tryout is missing one of its part sets.",
        });
      }

      return {
        partIndex: partSet.partIndex,
        partKey: partSet.partKey,
        setId: partSet.setId,
        setSlug: set.slug,
        material: set.material,
        questionCount: set.questionCount,
      };
    });

    return { tryout, parts };
  },
});
