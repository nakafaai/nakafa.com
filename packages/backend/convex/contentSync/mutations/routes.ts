import {
  CONTENT_ROUTE_ARTIFACT_PAGE_SIZE,
  CONTENT_ROUTE_KINDS,
} from "@repo/backend/convex/contents/constants";
import { internalMutation } from "@repo/backend/convex/functions";
import {
  localeValidator,
  nakafaSectionValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { ConvexError, v } from "convex/values";
import { literals } from "convex-helpers/validators";

const routeKindValidator = literals(...CONTENT_ROUTE_KINDS);
const staleRoutePageDeleteBatchSize = 500;

const contentRoutePageItemValidator = v.object({
  authors: v.array(v.object({ name: v.string() })),
  content_id: v.string(),
  date: v.optional(v.number()),
  depth: v.optional(v.number()),
  description: v.optional(v.string()),
  kind: routeKindValidator,
  locale: localeValidator,
  markdown: v.boolean(),
  official: v.optional(v.boolean()),
  parentRoute: v.optional(v.string()),
  route: v.string(),
  section: nakafaSectionValidator,
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

/** Upserts one bounded sitemap/LLMS route artifact page from sync. */
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
    if (args.routes.length > CONTENT_ROUTE_ARTIFACT_PAGE_SIZE) {
      throw new ConvexError({
        code: "CONTENT_ROUTE_ARTIFACT_PAGE_TOO_LARGE",
        message: `Content route artifact pages must contain at most ${CONTENT_ROUTE_ARTIFACT_PAGE_SIZE} routes.`,
      });
    }

    const existing = await ctx.db
      .query("contentRoutePages")
      .withIndex("by_locale_and_section_and_page", (q) =>
        q
          .eq("locale", args.locale)
          .eq("section", args.section)
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

    if (isSameRouteArtifactPage(existing, next)) {
      return { created: 0, unchanged: 1, updated: 0 };
    }

    if (existing) {
      await ctx.db.patch("contentRoutePages", existing._id, next);
      return { created: 0, unchanged: 0, updated: 1 };
    }

    await ctx.db.insert("contentRoutePages", next);
    return { created: 1, unchanged: 0, updated: 0 };
  },
});

/** Deletes materialized route artifact pages no longer produced by sync. */
export const deleteStaleContentRouteArtifactPages = internalMutation({
  args: {
    firstStalePage: v.number(),
    locale: localeValidator,
    section: nakafaSectionValidator,
  },
  returns: deleteResultValidator,
  /** Removes stale route artifact pages after the current page range. */
  handler: async (ctx, args) => {
    const pages = await ctx.db
      .query("contentRoutePages")
      .withIndex("by_locale_and_section_and_page", (q) =>
        q
          .eq("locale", args.locale)
          .eq("section", args.section)
          .gte("page", args.firstStalePage)
      )
      .take(staleRoutePageDeleteBatchSize);
    let deleted = 0;

    for (const page of pages) {
      if (page.page < args.firstStalePage) {
        continue;
      }

      await ctx.db.delete(page._id);
      deleted++;
    }

    return { deleted };
  },
});

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
