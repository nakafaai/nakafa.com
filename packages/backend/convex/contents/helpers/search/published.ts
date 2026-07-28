import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { decodeProjectionJson } from "@repo/backend/convex/contentRelease/parse";
import type { loadSearchOwner } from "@repo/backend/convex/contentRelease/search";
import { resolveSearchProjection } from "@repo/backend/convex/contentRelease/search/verify";
import { buildContentSearchDocument } from "@repo/backend/convex/contents/helpers/search/documents";
import {
  allocateSearchLimits,
  interleaveSearchGroups,
} from "@repo/backend/convex/contents/helpers/search/groups";
import { rankContentSearchDocuments } from "@repo/backend/convex/contents/helpers/search/rank";
import type { contentSearchInputValidator } from "@repo/backend/convex/contents/helpers/search/schema";
import { getExactRouteQuery } from "@repo/backend/convex/contents/helpers/search/terms";
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
    owner.readyFamilies.includes("material") &&
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
    const limits = allocateSearchLimits(scanLimit, families.length);
    const groups = yield* Effect.all(
      families.map((family, index) =>
        browseFamily(ctx, args.locale, family, limits[index] ?? 0, owner)
      ),
      { concurrency: "unbounded" }
    );
    return interleaveSearchGroups(groups);
  }
  const limits = allocateSearchLimits(scanLimit, queryTexts.length);
  const groups = yield* Effect.all(
    queryTexts.map((queryText, index) =>
      searchQuery(
        ctx,
        args.locale,
        families,
        queryText,
        limits[index] ?? 0,
        owner
      )
    ),
    { concurrency: "unbounded" }
  );
  return interleaveSearchGroups(groups);
});

/** Searches one query fairly across active release-owned families. */
const searchQuery = Effect.fn("contents.search.searchPublishedQuery")(
  function* (
    ctx: QueryCtx,
    locale: ContentSearchInput["locale"],
    families: readonly PublishedFamily[],
    queryText: string,
    scanLimit: number,
    owner: PublishedSearchOwner
  ) {
    const route = getExactRouteQuery(locale, queryText);
    const limits = allocateSearchLimits(scanLimit, families.length);
    const groups = yield* Effect.all(
      families.map((family, index) =>
        searchFamily(
          ctx,
          locale,
          family,
          route,
          queryText,
          limits[index] ?? 0,
          owner
        )
      ),
      { concurrency: "unbounded" }
    );
    return rankContentSearchDocuments(
      interleaveSearchGroups(groups),
      queryText
    );
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
    owner: PublishedSearchOwner
  ) {
    if (scanLimit <= 0) {
      return [];
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
    const hitLimit = scanLimit - (exact ? 1 : 0);
    const hits =
      hitLimit > 0
        ? yield* Effect.promise(() =>
            ctx.db
              .query("contentIndex")
              .withSearchIndex("search_text", (index) =>
                index
                  .search("text", queryText)
                  .eq("family", family)
                  .eq("locale", locale)
              )
              .take(hitLimit)
          )
        : [];
    const rows = exact
      ? [exact, ...hits.filter((row) => row._id !== exact._id)]
      : hits;
    return yield* authenticateSearchRows(ctx, rows, owner);
  }
);

/** Browses one active family through its stable route ordering. */
const browseFamily = Effect.fn("contents.search.browsePublishedFamily")(
  function* (
    ctx: QueryCtx,
    locale: ContentSearchInput["locale"],
    family: PublishedFamily,
    scanLimit: number,
    owner: PublishedSearchOwner
  ) {
    if (scanLimit <= 0) {
      return [];
    }
    const rows = yield* Effect.promise(() =>
      ctx.db
        .query("contentIndex")
        .withIndex("by_locale_and_family_and_publicPath", (index) =>
          index.eq("locale", locale).eq("family", family)
        )
        .take(scanLimit)
    );
    return yield* authenticateSearchRows(ctx, rows, owner);
  }
);

/** Authenticates indexed hits before projecting public search documents. */
function authenticateSearchRows(
  ctx: QueryCtx,
  rows: readonly Doc<"contentIndex">[],
  owner: PublishedSearchOwner
) {
  return Effect.forEach(rows, (row) => authenticateSearchRow(ctx, row, owner), {
    concurrency: "unbounded",
  });
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
