import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  appendSearchGroups,
  interleaveSearchGroups,
} from "@repo/backend/convex/contents/helpers/search/groups";
import { rankContentSearchDocuments } from "@repo/backend/convex/contents/helpers/search/rank";
import type { contentSearchInputValidator } from "@repo/backend/convex/contents/helpers/search/schema";
import {
  getExactRouteQuery,
  getRouteSearchText,
} from "@repo/backend/convex/contents/helpers/search/terms";
import type { NakafaSection } from "@repo/backend/convex/lib/validators/contents";
import type { Infer } from "convex/values";
import { Effect } from "effect";

type ContentSearchInput = Infer<typeof contentSearchInputValidator>;

/** Reads only sections still owned by the source-synchronized search model. */
export const readSourceSearchDocuments = Effect.fn(
  "contents.search.readSourceDocuments"
)(function* (
  ctx: QueryCtx,
  args: ContentSearchInput,
  queryTexts: readonly string[],
  scanLimit: number,
  sections: readonly NakafaSection[]
) {
  if (sections.length === 0) {
    return [];
  }
  if (queryTexts.length === 0) {
    const groups = yield* Effect.all(
      sections.map((section) =>
        browseSection(ctx, args.locale, section, scanLimit)
      ),
      { concurrency: "unbounded" }
    );
    return interleaveSearchGroups(groups);
  }
  const groups = yield* Effect.all(
    queryTexts.map((queryText) =>
      searchQuery(ctx, args.locale, sections, queryText, scanLimit)
    ),
    { concurrency: "unbounded" }
  );
  return interleaveSearchGroups(groups);
});

/** Searches one query fairly across every still-unmanaged section. */
const searchQuery = Effect.fn("contents.search.searchSourceQuery")(function* (
  ctx: QueryCtx,
  locale: ContentSearchInput["locale"],
  sections: readonly NakafaSection[],
  queryText: string,
  scanLimit: number
) {
  const groups = yield* Effect.all(
    sections.map((section) =>
      searchSection(ctx, locale, section, queryText, scanLimit)
    ),
    { concurrency: "unbounded" }
  );
  return interleaveSearchGroups(groups);
});

/** Runs title, text, route, and exact-path reads for one source-owned section. */
const searchSection = Effect.fn("contents.search.searchSourceSection")(
  function* (
    ctx: QueryCtx,
    locale: ContentSearchInput["locale"],
    section: NakafaSection,
    queryText: string,
    scanLimit: number
  ) {
    const [title, text, route, exact] = yield* Effect.all(
      [
        searchIndex(
          ctx,
          locale,
          section,
          "search_title",
          "title",
          queryText,
          scanLimit
        ),
        searchIndex(
          ctx,
          locale,
          section,
          "search_text",
          "text",
          queryText,
          scanLimit
        ),
        searchRoute(ctx, locale, section, queryText, scanLimit),
        readExactRoute(ctx, locale, section, queryText),
      ],
      { concurrency: "unbounded" }
    );
    const exactGroup = exact ? [exact] : [];
    if (section !== "tryout") {
      return appendSearchGroups([exactGroup, title, text, route]);
    }
    const documents = appendSearchGroups([exactGroup, route, text, title]);
    return rankContentSearchDocuments(documents, queryText);
  }
);

/** Runs one typed source-owned full-text index query. */
function searchIndex(
  ctx: QueryCtx,
  locale: ContentSearchInput["locale"],
  section: NakafaSection,
  index: "search_text" | "search_title",
  field: "text" | "title",
  queryText: string,
  scanLimit: number
) {
  return Effect.promise(() =>
    ctx.db
      .query("contentSearch")
      .withSearchIndex(index, (query) =>
        query
          .search(field, queryText)
          .eq("locale", locale)
          .eq("section", section)
      )
      .take(scanLimit)
  );
}

/** Searches normalized route tokens through the source-owned route index. */
function searchRoute(
  ctx: QueryCtx,
  locale: ContentSearchInput["locale"],
  section: NakafaSection,
  queryText: string,
  scanLimit: number
) {
  const routeQueryText = getRouteSearchText(queryText);
  if (!routeQueryText) {
    return Effect.succeed([]);
  }
  return Effect.promise(() =>
    ctx.db
      .query("contentSearch")
      .withSearchIndex("search_route", (query) =>
        query
          .search("route", routeQueryText)
          .eq("locale", locale)
          .eq("section", section)
      )
      .take(scanLimit)
  );
}

/** Resolves one exact source-owned route through its stable graph identity. */
const readExactRoute = Effect.fn("contents.search.readSourceRoute")(function* (
  ctx: QueryCtx,
  locale: ContentSearchInput["locale"],
  section: NakafaSection,
  queryText: string
) {
  const route = getExactRouteQuery(locale, queryText);
  if (!route) {
    return null;
  }
  const projection = yield* Effect.promise(() =>
    ctx.db
      .query("contentRoutes")
      .withIndex("by_locale_and_route", (query) =>
        query.eq("locale", locale).eq("route", route)
      )
      .unique()
  );
  if (!projection || projection.section !== section) {
    return null;
  }
  const document = yield* Effect.promise(() =>
    ctx.db
      .query("contentSearch")
      .withIndex("by_content_id", (query) =>
        query.eq("content_id", projection.content_id)
      )
      .unique()
  );
  return document?.section === section ? document : null;
});

/** Browses one bounded source-owned section in stable title order. */
function browseSection(
  ctx: QueryCtx,
  locale: ContentSearchInput["locale"],
  section: NakafaSection,
  scanLimit: number
) {
  return Effect.promise(() =>
    ctx.db
      .query("contentSearch")
      .withIndex("by_locale_and_section_and_title", (query) =>
        query.eq("locale", locale).eq("section", section)
      )
      .take(scanLimit)
  );
}
