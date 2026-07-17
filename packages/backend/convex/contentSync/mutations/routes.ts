import {
  CONTENT_ROUTE_ARTIFACT_PAGE_SIZE,
  CONTENT_ROUTE_KINDS,
} from "@repo/backend/convex/contents/constants";
import { learningGraphIdentityValidator } from "@repo/backend/convex/contents/graph";
import { internalMutation } from "@repo/backend/convex/functions";
import {
  localeValidator,
  materialValidator,
  nakafaSectionValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { ConvexError, getDocumentSize, v } from "convex/values";
import { literals } from "convex-helpers/validators";

const maximumContentRoutePageDocumentBytes = 1024 * 1024;
const routeKindValidator = literals(...CONTENT_ROUTE_KINDS);
const staleRoutePageDeleteBatchSize = 500;

const contentRoutePageItemValidator = v.object({
  ...learningGraphIdentityValidator.fields,
  authors: v.array(v.object({ name: v.string() })),
  content_id: v.string(),
  date: v.optional(v.number()),
  depth: v.optional(v.number()),
  description: v.optional(v.string()),
  kind: routeKindValidator,
  locale: localeValidator,
  markdown: v.boolean(),
  materialDomain: v.optional(materialValidator),
  official: v.optional(v.boolean()),
  parentRoute: v.optional(v.string()),
  route: v.string(),
  section: nakafaSectionValidator,
  sourceParentPath: v.optional(v.string()),
  sourcePath: v.string(),
  syncedAt: v.number(),
  title: v.string(),
});

const syncContentRouteArtifactPageResultValidator = v.object({
  created: v.number(),
  unchanged: v.number(),
  updated: v.number(),
});

const deleteResultValidator = v.object({
  deleted: v.number(),
});

/** Commits one route count as the visible artifact generation pointer. */
export const syncContentRouteArtifactCount = internalMutation({
  args: {
    count: v.number(),
    locale: localeValidator,
    section: nakafaSectionValidator,
    syncedAt: v.number(),
  },
  returns: syncContentRouteArtifactPageResultValidator,
  /** Stores the section route count produced by the artifact-page rebuild. */
  handler: async (ctx, args) => {
    assertValidArtifactCount(args.count);
    assertValidArtifactGeneration(args.syncedAt);

    const existing = await ctx.db
      .query("contentRouteCounts")
      .withIndex("by_locale_and_section", (q) =>
        q.eq("locale", args.locale).eq("section", args.section)
      )
      .unique();

    if (existing && args.syncedAt < existing.syncedAt) {
      throw new ConvexError({
        code: "CONTENT_ROUTE_ARTIFACT_GENERATION_STALE",
        message:
          "An older content route generation cannot replace the committed generation.",
      });
    }

    if (existing?.syncedAt === args.syncedAt) {
      if (existing.count !== args.count) {
        throw new ConvexError({
          code: "CONTENT_ROUTE_ARTIFACT_GENERATION_CONFLICT",
          message:
            "One content route generation cannot commit different counts.",
        });
      }

      return { created: 0, unchanged: 1, updated: 0 };
    }

    const next = {
      count: args.count,
      locale: args.locale,
      section: args.section,
      syncedAt: args.syncedAt,
    };

    if (existing) {
      await ctx.db.replace("contentRouteCounts", existing._id, next);
      return { created: 0, unchanged: 0, updated: 1 };
    }

    await ctx.db.insert("contentRouteCounts", next);
    return { created: 1, unchanged: 0, updated: 0 };
  },
});

/** Inserts one immutable sitemap/LLMS route page for a sync generation. */
export const syncContentRouteArtifactPage = internalMutation({
  args: {
    locale: localeValidator,
    page: v.number(),
    routes: v.array(contentRoutePageItemValidator),
    section: nakafaSectionValidator,
    syncedAt: v.number(),
  },
  returns: syncContentRouteArtifactPageResultValidator,
  /** Stores one route artifact page that public SEO/LLMS surfaces can read exactly. */
  handler: async (ctx, args) => {
    assertValidArtifactGeneration(args.syncedAt);

    if (
      args.routes.length < 1 ||
      args.routes.length > CONTENT_ROUTE_ARTIFACT_PAGE_SIZE
    ) {
      throw new ConvexError({
        code: "CONTENT_ROUTE_ARTIFACT_PAGE_SIZE_INVALID",
        message: `Content route artifact pages must contain between 1 and ${CONTENT_ROUTE_ARTIFACT_PAGE_SIZE} routes.`,
      });
    }

    if (!Number.isSafeInteger(args.page) || args.page < 0) {
      throw new ConvexError({
        code: "CONTENT_ROUTE_ARTIFACT_PAGE_INVALID",
        message:
          "Content route artifact page numbers must be non-negative integers.",
      });
    }

    const existing = await ctx.db
      .query("contentRoutePages")
      .withIndex("by_locale_and_section_and_syncedAt_and_page", (q) =>
        q
          .eq("locale", args.locale)
          .eq("section", args.section)
          .eq("syncedAt", args.syncedAt)
          .eq("page", args.page)
      )
      .unique();
    const next = {
      locale: args.locale,
      page: args.page,
      routeCount: args.routes.length,
      routes: args.routes,
      section: args.section,
      syncedAt: args.syncedAt,
    };

    if (getDocumentSize(next) >= maximumContentRoutePageDocumentBytes) {
      throw new ConvexError({
        code: "CONTENT_ROUTE_ARTIFACT_DOCUMENT_SIZE_INVALID",
        message:
          "Content route artifact pages must remain below the Convex 1 MiB document limit.",
      });
    }

    if (isSameRouteArtifactPage(existing, next)) {
      return { created: 0, unchanged: 1, updated: 0 };
    }

    if (existing) {
      throw new ConvexError({
        code: "CONTENT_ROUTE_ARTIFACT_GENERATION_CONFLICT",
        message:
          "One content route generation cannot contain different page payloads.",
      });
    }

    await ctx.db.insert("contentRoutePages", next);
    return { created: 1, unchanged: 0, updated: 0 };
  },
});

/** Deletes bounded pages older than the committed artifact generation. */
export const deleteStaleContentRouteArtifactPages = internalMutation({
  args: {
    committedSyncedAt: v.number(),
    locale: localeValidator,
    section: nakafaSectionValidator,
  },
  returns: deleteResultValidator,
  /** Removes older generations without touching a newer concurrent staging run. */
  handler: async (ctx, args) => {
    assertValidArtifactGeneration(args.committedSyncedAt);

    const pages = await ctx.db
      .query("contentRoutePages")
      .withIndex("by_locale_and_section_and_syncedAt_and_page", (q) =>
        q
          .eq("locale", args.locale)
          .eq("section", args.section)
          .lt("syncedAt", args.committedSyncedAt)
      )
      .take(staleRoutePageDeleteBatchSize);
    let deleted = 0;

    for (const page of pages) {
      await ctx.db.delete(page._id);
      deleted++;
    }

    return { deleted };
  },
});

/** Rejects counts that cannot represent an exact bounded route total. */
function assertValidArtifactCount(count: number) {
  if (Number.isSafeInteger(count) && count >= 0) {
    return;
  }

  throw new ConvexError({
    code: "CONTENT_ROUTE_ARTIFACT_COUNT_INVALID",
    message: "Content route artifact counts must be non-negative integers.",
  });
}

/** Rejects generation timestamps that cannot be ordered exactly. */
function assertValidArtifactGeneration(syncedAt: number) {
  if (Number.isSafeInteger(syncedAt) && syncedAt > 0) {
    return;
  }

  throw new ConvexError({
    code: "CONTENT_ROUTE_ARTIFACT_GENERATION_INVALID",
    message: "Content route artifact generations must be positive integers.",
  });
}

/** Checks whether a materialized route page already matches the next payload. */
function isSameRouteArtifactPage(
  existing: {
    routeCount: number;
    routes: readonly unknown[];
  } | null,
  next: {
    routeCount: number;
    routes: readonly unknown[];
  }
) {
  if (!existing) {
    return false;
  }

  return (
    existing.routeCount === next.routeCount &&
    JSON.stringify(existing.routes) === JSON.stringify(next.routes)
  );
}
