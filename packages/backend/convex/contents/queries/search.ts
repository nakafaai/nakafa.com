import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { query } from "@repo/backend/convex/_generated/server";
import {
  CONTENT_SEARCH_MAX_LIMIT,
  CONTENT_SEARCH_MAX_OFFSET,
  CONTENT_SEARCH_MAX_QUERIES,
} from "@repo/backend/convex/contents/search/constants";
import {
  contentSearchInputValidator,
  contentSearchResultValidator,
} from "@repo/backend/convex/contents/search/schema";
import { ConvexError, type Infer } from "convex/values";

type ContentSearchInput = Infer<typeof contentSearchInputValidator>;
type ContentSearchDocument = Doc<"contentSearch">;

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
    const queryTexts = validateSearchInput(args);
    const scanLimit = args.offset + args.limit + 1;

    if (queryTexts.length > 0) {
      const queryGroups = await Promise.all(
        queryTexts.map((queryText) =>
          searchContent(ctx, args, queryText, scanLimit)
        )
      );

      return buildSearchResult(args, mergeDocumentGroups(queryGroups));
    }

    return buildSearchResult(args, await browseContent(ctx, args, scanLimit));
  },
});

/** Validates bounded public search input and returns unique query texts. */
function validateSearchInput(args: ContentSearchInput) {
  if (args.limit < 1 || args.limit > CONTENT_SEARCH_MAX_LIMIT) {
    throw new ConvexError({
      code: "CONTENT_SEARCH_LIMIT_INVALID",
      message: `Content search limit must be between 1 and ${CONTENT_SEARCH_MAX_LIMIT}.`,
    });
  }

  if (args.offset < 0 || args.offset > CONTENT_SEARCH_MAX_OFFSET) {
    throw new ConvexError({
      code: "CONTENT_SEARCH_OFFSET_INVALID",
      message: `Content search offset must be between 0 and ${CONTENT_SEARCH_MAX_OFFSET}.`,
    });
  }

  const queryTexts = getQueryTexts(args);

  if (queryTexts.length > CONTENT_SEARCH_MAX_QUERIES) {
    throw new ConvexError({
      code: "CONTENT_SEARCH_QUERY_COUNT_INVALID",
      message: `Content search accepts at most ${CONTENT_SEARCH_MAX_QUERIES} unique queries.`,
    });
  }

  return queryTexts;
}

/** Normalizes primary and alternate query texts without changing wording. */
function getQueryTexts({ query, queries }: ContentSearchInput) {
  const texts: string[] = [];
  const seen = new Set<string>();

  appendQueryText(texts, seen, query);

  for (const queryText of queries ?? []) {
    appendQueryText(texts, seen, queryText);
  }

  return texts;
}

/** Appends one unique, non-empty query text. */
function appendQueryText(
  texts: string[],
  seen: Set<string>,
  queryText: string | undefined
) {
  const text = queryText?.trim();

  if (!text) {
    return;
  }

  const key = text.toLocaleLowerCase();

  if (seen.has(key)) {
    return;
  }

  texts.push(text);
  seen.add(key);
}

/** Runs one full-text query against title and body indexes in parallel. */
async function searchContent(
  ctx: QueryCtx,
  args: ContentSearchInput,
  queryText: string,
  scanLimit: number
) {
  const [titleDocuments, textDocuments] = await Promise.all([
    ctx.db
      .query("contentSearch")
      .withSearchIndex("search_title", (q) => {
        const builder = q.search("title", queryText).eq("locale", args.locale);

        if (!args.section) {
          return builder;
        }

        return builder.eq("section", args.section);
      })
      .take(scanLimit),
    ctx.db
      .query("contentSearch")
      .withSearchIndex("search_text", (q) => {
        const builder = q.search("text", queryText).eq("locale", args.locale);

        if (!args.section) {
          return builder;
        }

        return builder.eq("section", args.section);
      })
      .take(scanLimit),
  ]);

  return mergeDocumentGroups([titleDocuments, textDocuments]);
}

/** Browses a bounded, indexed page when the caller did not provide a query. */
function browseContent(
  ctx: QueryCtx,
  args: ContentSearchInput,
  scanLimit: number
) {
  if (!args.section) {
    return ctx.db
      .query("contentSearch")
      .withIndex("by_locale_and_title", (q) => q.eq("locale", args.locale))
      .take(scanLimit);
  }

  const section = args.section;

  return ctx.db
    .query("contentSearch")
    .withIndex("by_locale_and_section_and_title", (q) =>
      q.eq("locale", args.locale).eq("section", section)
    )
    .take(scanLimit);
}

/** Merges ranked result groups while preserving first-seen relevance order. */
function mergeDocumentGroups(
  groups: readonly (readonly ContentSearchDocument[])[]
) {
  const ranked: ContentSearchDocument[] = [];
  const seen = new Set<string>();

  for (const documents of groups) {
    for (const document of documents) {
      if (seen.has(document.content_id)) {
        continue;
      }

      ranked.push(document);
      seen.add(document.content_id);
    }
  }

  return ranked;
}

/** Builds the stable paginated search response shape used by tools and UI. */
function buildSearchResult(
  args: ContentSearchInput,
  ranked: ContentSearchDocument[]
) {
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
  const hasMore =
    ranked.length > nextOffset && nextOffset <= CONTENT_SEARCH_MAX_OFFSET;

  return {
    count: items.length,
    has_more: hasMore,
    items,
    limit: args.limit,
    next_offset: hasMore ? nextOffset : null,
    offset: args.offset,
  };
}
