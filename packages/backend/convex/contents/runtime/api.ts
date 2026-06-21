import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { NAKAFA_CONTENT_BASE_URL } from "@repo/backend/convex/contents/constants";
import {
  formatContentDate,
  getContentAuthors,
} from "@repo/backend/convex/contents/runtime/shared";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { ConvexError } from "convex/values";

const MAX_API_CONTENT_PAGE_SIZE = 100;

/** Bounded route-prefix page args for partner API content reads. */
interface ApiContentPrefixArgs {
  cursor: string | null;
  limit: number;
  locale: Locale;
  prefix: string;
}

/** Reads article API content rows by route prefix from the runtime table. */
export async function listArticleApiContentPageImpl(
  ctx: QueryCtx,
  args: ApiContentPrefixArgs
) {
  assertApiContentPageLimit(args.limit);
  const prefix = cleanApiContentPrefix(args.prefix);

  const page = await ctx.db
    .query("articleContents")
    .withIndex("by_locale_and_slug", (q) =>
      q
        .eq("locale", args.locale)
        .gte("slug", prefix)
        .lt("slug", `${prefix}\uffff`)
    )
    .paginate({ cursor: args.cursor, numItems: args.limit });
  const items = page.page.filter((article) =>
    matchesRouteSegmentPrefix(article.slug, prefix)
  );

  return {
    continueCursor: page.continueCursor,
    isDone: page.isDone,
    page: (
      await Promise.all(
        items.map(async (article) => {
          const graph = await getApiContentGraphProjection(ctx, {
            locale: article.locale,
            sourcePath: article.slug,
          });

          if (!graph) {
            return null;
          }

          const graphRef = toApiContentGraphRef(graph);

          return {
            ...graphRef,
            locale: article.locale,
            metadata: {
              authors: await getContentAuthors(ctx, {
                contentId: article._id,
                contentType: "article",
              }),
              date: formatContentDate(article.date),
              description: article.description,
              title: article.title,
            },
            raw: article.body,
            slug: article.slug,
            sourcePath: article.slug,
            url: `${NAKAFA_CONTENT_BASE_URL}/${article.locale}/${graph.publicPath}`,
          };
        })
      )
    ).filter((item) => item !== null),
  };
}

/** Reads material API content rows by route prefix from the runtime table. */
export async function listMaterialApiContentPageImpl(
  ctx: QueryCtx,
  args: ApiContentPrefixArgs
) {
  assertApiContentPageLimit(args.limit);
  const prefix = cleanApiContentPrefix(args.prefix);

  const page = await ctx.db
    .query("curriculumLessons")
    .withIndex("by_locale_and_slug", (q) =>
      q
        .eq("locale", args.locale)
        .gte("slug", prefix)
        .lt("slug", `${prefix}\uffff`)
    )
    .paginate({ cursor: args.cursor, numItems: args.limit });
  const items = page.page.filter((section) =>
    matchesRouteSegmentPrefix(section.slug, prefix)
  );

  return {
    continueCursor: page.continueCursor,
    isDone: page.isDone,
    page: (
      await Promise.all(
        items.map(async (section) => {
          const graph = await getApiContentGraphProjection(ctx, {
            locale: section.locale,
            sourcePath: section.slug,
          });

          if (!graph) {
            return null;
          }

          const graphRef = toApiContentGraphRef(graph);

          return {
            ...graphRef,
            locale: section.locale,
            metadata: {
              authors: await getContentAuthors(ctx, {
                contentId: section._id,
                contentType: "material",
              }),
              date: formatContentDate(section.date),
              description: section.description,
              subject: section.subject,
              title: section.title,
            },
            raw: section.body,
            slug: section.slug,
            sourcePath: section.slug,
            url: `${NAKAFA_CONTENT_BASE_URL}/${section.locale}/${graph.publicPath}`,
          };
        })
      )
    ).filter((item) => item !== null),
  };
}

/** Loads graph identity from the durable route catalog instead of the slug. */
async function getApiContentGraphProjection(
  ctx: QueryCtx,
  args: {
    locale: Locale;
    sourcePath: string;
  }
) {
  const route = await ctx.db
    .query("contentRoutes")
    .withIndex("by_locale_and_sourcePath", (q) =>
      q.eq("locale", args.locale).eq("sourcePath", args.sourcePath)
    )
    .unique();

  if (!route) {
    return null;
  }

  return {
    alignmentId: route.alignmentId,
    assetId: route.assetId,
    conceptId: route.conceptId,
    learningObjectId: route.learningObjectId,
    lensId: route.lensId,
    publicPath: route.route,
  };
}

/** Keeps public API response rows aligned with their runtime validator. */
function toApiContentGraphRef(
  graph: NonNullable<Awaited<ReturnType<typeof getApiContentGraphProjection>>>
) {
  return {
    alignmentId: graph.alignmentId,
    assetId: graph.assetId,
    conceptId: graph.conceptId,
    learningObjectId: graph.learningObjectId,
    lensId: graph.lensId,
  };
}

/** Normalizes API route prefixes before indexed range scans. */
function cleanApiContentPrefix(prefix: string) {
  return prefix.replace(/^\/+|\/+$/g, "");
}

/** Checks exact-or-descendant route matches without sibling prefix bleed. */
function matchesRouteSegmentPrefix(route: string, prefix: string) {
  if (prefix.length === 0 || route === prefix) {
    return true;
  }

  return route.startsWith(`${prefix}/`);
}

/** Rejects API content scans that exceed the public runtime page bound. */
function assertApiContentPageLimit(limit: number) {
  if (limit >= 1 && limit <= MAX_API_CONTENT_PAGE_SIZE) {
    return;
  }

  throw new ConvexError({
    code: "API_CONTENT_PAGE_LIMIT_INVALID",
    message: `API content page limit must be between 1 and ${MAX_API_CONTENT_PAGE_SIZE}.`,
  });
}
