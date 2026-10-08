import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { ModelSlot } from "@repo/backend/confect/contentRelease/models/slot";
import type { loadSearchOwner } from "@repo/backend/confect/contentRelease/search/owner";
import { resolveSearchProjection } from "@repo/backend/confect/contentRelease/search/verify";
import { buildContentSearchDocument } from "@repo/backend/confect/contents/helpers/search/documents";
import {
  type ContentSearchDocument,
  interleaveSearchGroups,
} from "@repo/backend/confect/contents/helpers/search/groups";
import { rankContentSearchDocuments } from "@repo/backend/confect/contents/helpers/search/rank";
import type { contentSearchInputValidator } from "@repo/backend/confect/contents/helpers/search/schema";
import { getExactRouteQuery } from "@repo/backend/confect/contents/helpers/search/terms";
import { NAKAFA_AGENT_SEARCH_WINDOW } from "@repo/contents/agent/search";
import { Array as Arr, Effect } from "effect";

type ContentSearchInput = typeof contentSearchInputValidator.Type;
type PublishedSearchOwner = NonNullable<
  Effect.Success<ReturnType<typeof loadSearchOwner>>
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
  let families: PublishedFamily[] = [];
  if (
    owner.families.includes("article") &&
    (section === undefined || section === "articles")
  ) {
    families = Arr.append(families, "article");
  }
  if (
    owner.families.includes("material") &&
    (section === undefined || section === "material")
  ) {
    families = Arr.append(families, "material");
  }
  return families;
}
/** Reads authenticated documents from the active release-owned search model. */
export const readPublishedSearchDocuments = Effect.fn(
  "contents.search.readPublishedDocuments"
)(function* (
  args: ContentSearchInput,
  queryTexts: readonly string[],
  scanLimit: number,
  owner: PublishedSearchOwner,
  families: readonly PublishedFamily[]
) {
  if (queryTexts.length === 0) {
    const groups = yield* Effect.forEach(
      families,
      (family) =>
        browseFamily(
          owner.slot,
          args.locale,
          family,
          NAKAFA_AGENT_SEARCH_WINDOW
        ),
      {
        concurrency: "unbounded",
      }
    );
    const rows = interleaveSearchGroups(
      groups,
      NAKAFA_AGENT_SEARCH_WINDOW,
      (row) => row._id
    );
    const authenticated = yield* authenticateSearchRows(rows, owner);
    return Arr.map(authenticated, ({ document }) => document).slice(
      0,
      scanLimit
    );
  }
  const groups = yield* Effect.forEach(
    queryTexts,
    (queryText) =>
      searchQuery(
        owner.slot,
        args.locale,
        families,
        queryText,
        NAKAFA_AGENT_SEARCH_WINDOW
      ).pipe(
        Effect.map((rows) => ({
          queryText,
          rows,
        }))
      ),
    {
      concurrency: "unbounded",
    }
  );
  const rows = interleaveSearchGroups(
    Arr.map(groups, (group) => group.rows),
    NAKAFA_AGENT_SEARCH_WINDOW,
    (row) => row._id
  );
  const authenticated = yield* authenticateSearchRows(rows, owner);
  const documentsByRow = new Map(
    Arr.map(authenticated, ({ document, row }) => [row._id, document])
  );
  const rankedGroups = Arr.map(groups, ({ queryText, rows: queryRows }) => {
    let documents: ContentSearchDocument[] = [];
    for (const row of queryRows) {
      const document = documentsByRow.get(row._id);
      if (document) {
        documents = Arr.append(documents, document);
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
    slot: ModelSlot,
    locale: ContentSearchInput["locale"],
    families: readonly PublishedFamily[],
    queryText: string,
    scanLimit: number
  ) {
    const route = getExactRouteQuery(locale, queryText);
    const groups = yield* Effect.forEach(
      families,
      (family) =>
        searchFamily(slot, locale, family, route, queryText, scanLimit),
      {
        concurrency: "unbounded",
      }
    );
    return interleaveSearchGroups(groups, scanLimit, (row) => row._id);
  }
);
/** Reads full-text and exact-path candidates for one active family. */
const searchFamily = Effect.fn("contents.search.searchPublishedFamily")(
  function* (
    slot: ModelSlot,
    locale: ContentSearchInput["locale"],
    family: PublishedFamily,
    route: null | string,
    queryText: string,
    scanLimit: number
  ) {
    const database = yield* DatabaseReader;
    const exact = route
      ? yield* database
          .table("contentIndex")
          .get(
            "by_slot_and_appLocale_and_family_and_publicPath",
            slot,
            locale,
            family,
            route
          )
          .pipe(
            Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null))
          )
      : null;
    const hits = yield* database
      .table("contentIndex")
      .search("search_text_by_slot_and_family_and_appLocale", (index) =>
        index
          .search("text", queryText)
          .eq("slot", slot)
          .eq("family", family)
          .eq("appLocale", locale)
      )
      .take(scanLimit);
    const rows = exact
      ? [exact, ...Arr.filter(hits, (row) => row._id !== exact._id)]
      : hits;
    return rows.slice(0, scanLimit);
  },
  Effect.orDie
);
/** Browses one active family through its stable route ordering. */
const browseFamily = Effect.fn("contents.search.browsePublishedFamily")(
  function* (
    slot: ModelSlot,
    locale: ContentSearchInput["locale"],
    family: PublishedFamily,
    scanLimit: number
  ) {
    const database = yield* DatabaseReader;
    const rows = yield* database
      .table("contentIndex")
      .index("by_slot_and_appLocale_and_family_and_publicPath", (index) =>
        index.eq("slot", slot).eq("appLocale", locale).eq("family", family)
      )
      .take(scanLimit)
      .pipe(Effect.orDie);
    return rows;
  }
);
/** Authenticates indexed hits before projecting public search documents. */
function authenticateSearchRows(
  rows: readonly Docs["contentIndex"][],
  owner: PublishedSearchOwner
) {
  return Effect.forEach(
    rows,
    (row) =>
      authenticateSearchRow(row, owner).pipe(
        Effect.map((document) => ({
          document,
          row,
        }))
      ),
    {
      concurrency: "unbounded",
    }
  );
}
/** Verifies one search hit against its active immutable projection. */
const authenticateSearchRow = Effect.fn(
  "contents.search.authenticatePublishedRow"
)(function* (row: Docs["contentIndex"], owner: PublishedSearchOwner) {
  const resolved = yield* resolveSearchProjection(row, owner);
  const projection = resolved.projection;
  const section = projection.kind === "article" ? "articles" : "material";
  return buildContentSearchDocument({
    ...projection.graph,
    contentHash: row.projectionHash,
    ...(projection.metadata.description === undefined
      ? {}
      : {
          description: projection.metadata.description,
        }),
    hasMarkdownSource: true,
    locale: projection.appLocale,
    route: projection.publicPath,
    section,
    sourcePath: resolved.sourcePath,
    syncedAt: row.sequence,
    text: row.text,
    title: projection.metadata.title,
  });
});
