import { query } from "@repo/backend/convex/_generated/server";
import {
  contentSearchInputValidator,
  contentSearchResultValidator,
} from "@repo/backend/convex/contents/search/schema";
import {
  nakafaSearchMaxLimit,
  nakafaSearchMaxOffset,
} from "@repo/utilities/nakafa";
import { ConvexError } from "convex/values";

/**
 * Searches synced content with title matches ranked before body matches.
 *
 * References:
 * - Convex full-text search:
 *   https://docs.convex.dev/search/text-search
 * - Convex bounded query guidance:
 *   https://docs.convex.dev/understanding/best-practices/
 */
export const search = query({
  args: contentSearchInputValidator,
  returns: contentSearchResultValidator,
  handler: async (ctx, args) => {
    if (args.limit < 1 || args.limit > nakafaSearchMaxLimit) {
      throw new ConvexError({
        code: "CONTENT_SEARCH_LIMIT_INVALID",
        message: `Content search limit must be between 1 and ${nakafaSearchMaxLimit}.`,
      });
    }

    if (args.offset < 0 || args.offset > nakafaSearchMaxOffset) {
      throw new ConvexError({
        code: "CONTENT_SEARCH_OFFSET_INVALID",
        message: `Content search offset must be between 0 and ${nakafaSearchMaxOffset}.`,
      });
    }

    const queryText = args.query?.trim();
    const scanLimit = args.offset + args.limit + 1;

    if (queryText) {
      const titleDocuments = await ctx.db
        .query("contentSearch")
        .withSearchIndex("search_title", (q) => {
          const builder = q
            .search("title", queryText)
            .eq("locale", args.locale);

          if (!args.section) {
            return builder;
          }

          return builder.eq("section", args.section);
        })
        .take(scanLimit);
      const textDocuments = await ctx.db
        .query("contentSearch")
        .withSearchIndex("search_text", (q) => {
          const builder = q.search("text", queryText).eq("locale", args.locale);

          if (!args.section) {
            return builder;
          }

          return builder.eq("section", args.section);
        })
        .take(scanLimit);
      const ranked = [...titleDocuments];
      const seen = new Set(
        titleDocuments.map((document) => document.content_id)
      );

      for (const document of textDocuments) {
        if (seen.has(document.content_id)) {
          continue;
        }

        ranked.push(document);
        seen.add(document.content_id);
      }

      const items = ranked
        .slice(args.offset, args.offset + args.limit)
        .map((document) => ({
          content_id: document.content_id,
          description: document.description,
          locale: document.locale,
          markdown_url: document.markdown_url,
          route: document.route,
          section: document.section,
          title: document.title,
          url: document.url,
        }));
      const nextOffset = args.offset + items.length;
      const hasMore = ranked.length > nextOffset;

      return {
        count: items.length,
        has_more: hasMore,
        items,
        limit: args.limit,
        next_offset: hasMore ? nextOffset : null,
        offset: args.offset,
      };
    }

    const section = args.section;
    const ranked = section
      ? await ctx.db
          .query("contentSearch")
          .withIndex("by_locale_and_section_and_title", (q) =>
            q.eq("locale", args.locale).eq("section", section)
          )
          .take(scanLimit)
      : await ctx.db
          .query("contentSearch")
          .withIndex("by_locale_and_title", (q) => q.eq("locale", args.locale))
          .take(scanLimit);
    const items = ranked
      .slice(args.offset, args.offset + args.limit)
      .map((document) => ({
        content_id: document.content_id,
        description: document.description,
        locale: document.locale,
        markdown_url: document.markdown_url,
        route: document.route,
        section: document.section,
        title: document.title,
        url: document.url,
      }));
    const nextOffset = args.offset + items.length;
    const hasMore = ranked.length > nextOffset;

    return {
      count: items.length,
      has_more: hasMore,
      items,
      limit: args.limit,
      next_offset: hasMore ? nextOffset : null,
      offset: args.offset,
    };
  },
});
