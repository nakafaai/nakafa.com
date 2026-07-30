import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { readExactMaterialSnapshot } from "@repo/backend/convex/contentRelease/material/exact";
import { decodeProjectionJson } from "@repo/backend/convex/contentRelease/parse";
import type { loadSearchOwner } from "@repo/backend/convex/contentRelease/search";
import { resolveSearchProjection } from "@repo/backend/convex/contentRelease/search/verify";
import { buildContentSearchDocument } from "@repo/backend/convex/contents/helpers/search/documents";
import {
  type ContentSearchDocument,
  interleaveSearchGroups,
} from "@repo/backend/convex/contents/helpers/search/groups";
import {
  matchesContentSearchQuery,
  rankContentSearchDocuments,
} from "@repo/backend/convex/contents/helpers/search/rank";
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
    owner.readyFamilies.includes("article") &&
    (section === undefined || section === "articles")
  ) {
    families.push("article");
  }
  if (
    owner.materialReady &&
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
  const exactMaterialRows = yield* loadExactMaterialSearchRows(
    ctx,
    args.locale,
    owner,
    families
  );
  if (queryTexts.length === 0) {
    const groups = yield* Effect.all(
      families.map((family) =>
        browseFamily(
          ctx,
          args.locale,
          family,
          NAKAFA_AGENT_SEARCH_WINDOW,
          exactMaterialRows
        )
      ),
      { concurrency: "unbounded" }
    );
    const rows = interleaveSearchGroups(
      groups,
      NAKAFA_AGENT_SEARCH_WINDOW,
      (row) => row._id
    );
    const authenticated = yield* authenticateSearchRows(ctx, rows, owner);
    return authenticated.map(({ document }) => document).slice(0, scanLimit);
  }
  const groups = yield* Effect.all(
    queryTexts.map((queryText) =>
      searchQuery(
        ctx,
        args.locale,
        families,
        queryText,
        NAKAFA_AGENT_SEARCH_WINDOW,
        exactMaterialRows
      ).pipe(Effect.map((rows) => ({ queryText, rows })))
    ),
    { concurrency: "unbounded" }
  );
  const rows = interleaveSearchGroups(
    groups.map((group) => group.rows),
    NAKAFA_AGENT_SEARCH_WINDOW,
    (row) => row._id
  );
  const authenticated = yield* authenticateSearchRows(ctx, rows, owner);
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

/** Loads search rows for the bounded active exact material projection. */
const loadExactMaterialSearchRows = Effect.fn(
  "contents.search.loadExactMaterialRows"
)(function* (
  ctx: QueryCtx,
  locale: ContentSearchInput["locale"],
  owner: PublishedSearchOwner,
  families: readonly PublishedFamily[]
) {
  if (!families.includes("material") || owner.families.includes("material")) {
    return null;
  }
  const snapshot = yield* readExactMaterialSnapshot(ctx, owner, locale);
  const rows = yield* Effect.forEach(snapshot.materials, ({ row }) =>
    Effect.gen(function* () {
      const indexed = yield* Effect.promise(() =>
        ctx.db
          .query("contentIndex")
          .withIndex("by_contentKey_and_locale", (index) =>
            index.eq("contentKey", row.contentKey).eq("locale", row.locale)
          )
          .unique()
      );
      if (!indexed) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Exact material search entry ${row.contentKey}/${row.locale} is missing.`
        );
      }
      return indexed;
    })
  );
  return rows.sort((left, right) =>
    left.publicPath.localeCompare(right.publicPath)
  );
});

/** Reads one fixed raw candidate window across active published families. */
const searchQuery = Effect.fn("contents.search.searchPublishedQuery")(
  function* (
    ctx: QueryCtx,
    locale: ContentSearchInput["locale"],
    families: readonly PublishedFamily[],
    queryText: string,
    scanLimit: number,
    exactMaterialRows: readonly Doc<"contentIndex">[] | null
  ) {
    const route = getExactRouteQuery(locale, queryText);
    const groups = yield* Effect.all(
      families.map((family) =>
        searchFamily(
          ctx,
          locale,
          family,
          route,
          queryText,
          scanLimit,
          exactMaterialRows
        )
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
    scanLimit: number,
    exactMaterialRows: readonly Doc<"contentIndex">[] | null
  ) {
    if (scanLimit <= 0) {
      return [];
    }
    if (family === "material" && exactMaterialRows) {
      const exact = route
        ? exactMaterialRows.find((row) => row.publicPath === route)
        : undefined;
      const hits = exactMaterialRows.filter((row) =>
        matchesContentSearchQuery(row.text, queryText)
      );
      const rows = exact
        ? [exact, ...hits.filter((row) => row._id !== exact._id)]
        : hits;
      return rows.slice(0, scanLimit);
    }
    const exact = route
      ? yield* Effect.promise(() =>
          ctx.db
            .query("contentIndex")
            .withIndex("by_locale_and_family_and_publicPath", (index) =>
              index
                .eq("locale", locale)
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
            .eq("locale", locale)
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
    scanLimit: number,
    exactMaterialRows: readonly Doc<"contentIndex">[] | null
  ) {
    if (scanLimit <= 0) {
      return [];
    }
    if (family === "material" && exactMaterialRows) {
      return exactMaterialRows.slice(0, scanLimit);
    }
    const rows = yield* Effect.promise(() =>
      ctx.db
        .query("contentIndex")
        .withIndex("by_locale_and_family_and_publicPath", (index) =>
          index.eq("locale", locale).eq("family", family)
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
  owner: PublishedSearchOwner
) {
  return Effect.forEach(
    rows,
    (row) =>
      authenticateSearchRow(ctx, row, owner).pipe(
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
  owner: PublishedSearchOwner
) {
  const resolved = yield* resolveSearchProjection(ctx, row, owner);
  if (!resolved) {
    return null;
  }
  const projection = yield* decodeProjectionJson(resolved.projectionJson);
  if (projection.kind === "question-body") {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Active search entry ${row.contentKey}/${row.locale} exposes a question body.`
    );
  }
  const section = projection.kind === "article" ? "articles" : "material";
  return buildContentSearchDocument({
    ...projection.graph,
    contentHash: row.projectionHash,
    description: projection.metadata.description,
    locale: projection.locale,
    route: projection.publicPath,
    section,
    sourcePath: resolved.sourcePath,
    syncedAt: row.sequence,
    text: row.text,
    title: projection.metadata.title,
  });
});
