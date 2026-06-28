import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { rankContentSearchDocuments } from "@repo/backend/convex/contents/helpers/search/rank";
import type { contentSearchInputValidator } from "@repo/backend/convex/contents/helpers/search/schema";
import { cleanSlug } from "@repo/utilities/helper";
import type { Infer } from "convex/values";

type ContentSearchInput = Infer<typeof contentSearchInputValidator>;
type ContentSearchDocument = Doc<"contentSearch">;

const practiceSourcePathPrefix = "material/practice/";
const routeSeparatorPattern = /[/_-]+/g;

/** Reads a bounded search page from the derived content search table. */
export async function readContentSearchDocuments(
  ctx: QueryCtx,
  args: ContentSearchInput,
  queryTexts: readonly string[],
  scanLimit: number
) {
  if (queryTexts.length === 0) {
    return browseContent(ctx, args, scanLimit);
  }

  const queryGroups = await Promise.all(
    queryTexts.map((queryText) =>
      searchContent(ctx, args, queryText, scanLimit)
    )
  );

  return interleaveDocumentGroups(queryGroups);
}

/** Runs one full-text query against title, prose, and route indexes in parallel. */
async function searchContent(
  ctx: QueryCtx,
  args: ContentSearchInput,
  queryText: string,
  scanLimit: number
) {
  const routeQueryText = getRouteSearchText(queryText);
  const [titleDocuments, textDocuments, routeDocuments, routeLookupDocument] =
    await Promise.all([
      ctx.db
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
      searchRoutes(ctx, args, routeQueryText, scanLimit),
      readExactRouteContent(ctx, args, queryText),
    ]);
  const routeLookupDocuments = routeLookupDocument ? [routeLookupDocument] : [];

  const searchGroups = [titleDocuments, textDocuments, routeDocuments];
  const hasPracticeContext = searchGroups
    .flat()
    .some((document) =>
      document.sourcePath.startsWith(practiceSourcePathPrefix)
    );
  const documents = hasPracticeContext
    ? appendDocumentGroups([
        routeLookupDocuments,
        routeDocuments,
        textDocuments,
        titleDocuments,
      ])
    : appendDocumentGroups([
        routeLookupDocuments,
        titleDocuments,
        textDocuments,
        routeDocuments,
      ]);

  if (hasPracticeContext) {
    // Practice titles are often generic ("Soal 11"), so route and body text
    // carry the discriminating material, set, and question context.
    return rankContentSearchDocuments(documents, queryText);
  }

  return documents;
}

/** Converts path-like route queries into the token form Convex search expects. */
function getRouteSearchText(queryText: string) {
  return queryText.replace(routeSeparatorPattern, " ").trim();
}

/** Searches route tokens through the dedicated route search index. */
function searchRoutes(
  ctx: QueryCtx,
  args: ContentSearchInput,
  routeQueryText: string,
  scanLimit: number
) {
  if (!routeQueryText) {
    return [];
  }

  return ctx.db
    .query("contentSearch")
    .withSearchIndex("search_route", (q) => {
      const builder = q
        .search("route", routeQueryText)
        .eq("locale", args.locale);

      if (!args.section) {
        return builder;
      }

      return builder.eq("section", args.section);
    })
    .take(scanLimit);
}

/** Reads an exact route query through the stable content ID index. */
async function readExactRouteContent(
  ctx: QueryCtx,
  args: ContentSearchInput,
  queryText: string
) {
  const route = getExactRouteQuery(args.locale, queryText);

  if (!route) {
    return null;
  }

  const routeProjection = await ctx.db
    .query("contentRoutes")
    .withIndex("by_locale_and_route", (q) =>
      q.eq("locale", args.locale).eq("route", route)
    )
    .unique();

  if (!routeProjection) {
    return null;
  }

  if (args.section && routeProjection.section !== args.section) {
    return null;
  }

  const document = await ctx.db
    .query("contentSearch")
    .withIndex("by_content_id", (q) =>
      q.eq("content_id", routeProjection.content_id)
    )
    .unique();

  if (!document) {
    return null;
  }

  if (args.section && document.section !== args.section) {
    return null;
  }

  return document;
}

/** Parses exact path-like route searches without treating plain words as routes. */
function getExactRouteQuery(
  locale: ContentSearchInput["locale"],
  queryText: string
) {
  const route = cleanSlug(queryText);
  const localePrefix = `${locale}/`;

  if (!route) {
    return null;
  }

  if (route.startsWith(localePrefix)) {
    return route.slice(localePrefix.length);
  }

  if (!route.includes("/")) {
    return null;
  }

  return route;
}

/** Merges query variants fairly so one broad query cannot fill the page alone. */
function interleaveDocumentGroups(
  groups: readonly (readonly ContentSearchDocument[])[]
) {
  const ranked: ContentSearchDocument[] = [];
  const seen = new Set<string>();
  const maxLength = Math.max(0, ...groups.map((documents) => documents.length));

  for (let index = 0; index < maxLength; index++) {
    for (const documents of groups) {
      const document = documents[index];

      if (!document || seen.has(document.content_id)) {
        continue;
      }

      ranked.push(document);
      seen.add(document.content_id);
    }
  }

  return ranked;
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
function appendDocumentGroups(
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
