import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { decodeProjectionJson } from "@repo/backend/convex/contentRelease/parse";
import type { loadSearchOwner } from "@repo/backend/convex/contentRelease/search/owner";
import { resolveSearchProjection } from "@repo/backend/convex/contentRelease/search/verify";
import { buildContentSearchDocument } from "@repo/backend/convex/contents/helpers/search/documents";
import {
  type ContentSearchDocument,
  interleaveSearchGroups,
} from "@repo/backend/convex/contents/helpers/search/groups";
import { rankContentSearchDocuments } from "@repo/backend/convex/contents/helpers/search/rank";
import type { contentSearchInputValidator } from "@repo/backend/convex/contents/helpers/search/schema";
import { getExactRouteQuery } from "@repo/backend/convex/contents/helpers/search/terms";
import { NAKAFA_AGENT_SEARCH_WINDOW } from "@repo/contents/_types/agent/search";
import type { Infer } from "convex/values";
import { Effect } from "effect";

type ContentSearchInput = Infer<typeof contentSearchInputValidator>;
type PublishedSearchOwner = NonNullable<
  Effect.Effect.Success<ReturnType<typeof loadSearchOwner>>
>;
type PublishedFamily = "article" | "material";

/** Returns active searchable families selected by the requested UI section. */
export function getPublishedSearchFamilies(
  owner: PublishedSearchOwner | null,
  section: ContentSearchInput["section"]
) {
  if (!owner) {
    return [];
  }
  const families: PublishedFamily[] = [];
  if (
    owner.families.includes("article") &&
    (section === undefined || section === "articles")
  ) {
    families.push("article");
  }
  if (
    owner.families.includes("material") &&
    (section === undefined || section === "material")
  ) {
    families.push("material");
  }
  return families;
}

/** Reads authenticated documents from the active release-owned search model. */
export const readPublishedSearchDocuments = Effect.fn(
  "contents.search.readPublishedDocuments"
)(function* (
  ctx: QueryCtx,
  args: ContentSearchInput,
  queryTexts: readonly string[],
  scanLimit: number,
  owner: PublishedSearchOwner,
  families: readonly PublishedFamily[]
) {
  if (queryTexts.length === 0) {
    const groups = yield* Effect.all(
      families.map((family) =>
        browseFamily(ctx, args.locale, family, NAKAFA_AGENT_SEARCH_WINDOW)
      ),
      { concurrency: "unbounded" }
    );
    const rows = interleaveSearchGroups(
      groups,
      NAKAFA_AGENT_SEARCH_WINDOW,
      (row) => row._id
    );
    const authenticated = yield* authenticateSearchRows(
      ctx,
      rows,
      owner,
      args.locale
    );
    return authenticated.map(({ document }) => document).slice(0, scanLimit);
  }
  const groups = yield* Effect.all(
    queryTexts.map((queryText) =>
      searchQuery(
        ctx,
        args.locale,
        families,
        queryText,
        NAKAFA_AGENT_SEARCH_WINDOW
      ).pipe(Effect.map((rows) => ({ queryText, rows })))
    ),
    { concurrency: "unbounded" }
  );
  const rows = interleaveSearchGroups(
    groups.map((group) => group.rows),
    NAKAFA_AGENT_SEARCH_WINDOW,
    (row) => row._id
  );
  const authenticated = yield* authenticateSearchRows(
    ctx,
    rows,
    owner,
    args.locale
  );
  const documentsByRow = new Map(
    authenticated.map(({ document, row }) => [row._id, document])
  );
  const rankedGroups = groups.map(({ queryText, rows: queryRows }) => {
    const documents: ContentSearchDocument[] = [];

    for (const row of queryRows) {
      const document = documentsByRow.get(row._id);

      if (document) {
        documents.push(document);
      }
    }

    return rankContentSearchDocuments(documents, queryText);
  });
  return interleaveSearchGroups(
    rankedGroups,
    scanLimit,
    (document) => document.content_id
  );
});

/** Reads one fixed raw candidate window across active published families. */
const searchQuery = Effect.fn("contents.search.searchPublishedQuery")(
  function* (
    ctx: QueryCtx,
    locale: ContentSearchInput["locale"],
    families: readonly PublishedFamily[],
    queryText: string,
    scanLimit: number
  ) {
    const route = getExactRouteQuery(locale, queryText);
    const groups = yield* Effect.all(
      families.map((family) =>
        searchFamily(ctx, locale, family, route, queryText, scanLimit)
      ),
      { concurrency: "unbounded" }
    );
    return interleaveSearchGroups(groups, scanLimit, (row) => row._id);
  }
);

/** Reads full-text and exact-path candidates for one active family. */
const searchFamily = Effect.fn("contents.search.searchPublishedFamily")(
  function* (
    ctx: QueryCtx,
    locale: ContentSearchInput["locale"],
    family: PublishedFamily,
    route: null | string,
    queryText: string,
    scanLimit: number
  ) {
    if (scanLimit <= 0) {
      return [];
    }
    const exact = route
      ? yield* Effect.promise(() =>
          ctx.db
            .query("contentIndex")
            .withIndex("by_appLocale_and_family_and_publicPath", (index) =>
              index
                .eq("appLocale", locale)
                .eq("family", family)
                .eq("publicPath", route)
            )
            .unique()
        )
      : null;
    const hits = yield* Effect.promise(() =>
      ctx.db
        .query("contentIndex")
        .withSearchIndex("search_text", (index) =>
          index
            .search("text", queryText)
            .eq("family", family)
            .eq("appLocale", locale)
        )
        .take(scanLimit)
    );
    const rows = exact
      ? [exact, ...hits.filter((row) => row._id !== exact._id)]
      : hits;
    return rows.slice(0, scanLimit);
  }
);

/** Browses one active family through its stable route ordering. */
const browseFamily = Effect.fn("contents.search.browsePublishedFamily")(
  function* (
    ctx: QueryCtx,
    locale: ContentSearchInput["locale"],
    family: PublishedFamily,
    scanLimit: number
  ) {
    if (scanLimit <= 0) {
      return [];
    }
    const rows = yield* Effect.promise(() =>
      ctx.db
        .query("contentIndex")
        .withIndex("by_appLocale_and_family_and_publicPath", (index) =>
          index.eq("appLocale", locale).eq("family", family)
        )
        .take(scanLimit)
    );
    return rows;
  }
);

/** Authenticates indexed hits before projecting public search documents. */
function authenticateSearchRows(
  ctx: QueryCtx,
  rows: readonly Doc<"contentIndex">[],
  owner: PublishedSearchOwner,
  locale: ContentSearchInput["locale"]
) {
  return Effect.forEach(
    rows,
    (row) =>
      authenticateSearchRow(ctx, row, owner, locale).pipe(
        Effect.map((document) => (document ? { document, row } : null))
      ),
    { concurrency: "unbounded" }
  ).pipe(Effect.map((results) => results.filter((result) => result !== null)));
}

/** Verifies one search hit against its active immutable projection. */
const authenticateSearchRow = Effect.fn(
  "contents.search.authenticatePublishedRow"
)(function* (
  ctx: QueryCtx,
  row: Doc<"contentIndex">,
  owner: PublishedSearchOwner,
  locale: ContentSearchInput["locale"]
) {
  if (row.appLocale !== locale) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active search entry ${row.contentKey}/${row.appLocale} escaped the requested locale.`
    );
  }
  const resolved = yield* resolveSearchProjection(ctx, row, owner);
  if (!resolved) {
    return null;
  }
  const projection = yield* decodeProjectionJson(resolved.projectionJson);
  if (projection.kind === "question-body") {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active search entry ${row.contentKey}/${row.appLocale} exposes a question body.`
    );
  }
  const section = projection.kind === "article" ? "articles" : "material";
  return buildContentSearchDocument({
    ...projection.graph,
    contentHash: row.projectionHash,
    description: projection.metadata.description,
    locale,
    route: projection.publicPath,
    section,
    sourcePath: resolved.sourcePath,
    syncedAt: row.sequence,
    text: row.text,
    title: projection.metadata.title,
  });
});
