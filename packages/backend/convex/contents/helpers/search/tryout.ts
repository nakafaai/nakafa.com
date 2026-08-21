import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { findTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/catalog";
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
import {
  getExactRouteQuery,
  getRouteSearchText,
} from "@repo/backend/convex/contents/helpers/search/terms";
import { NAKAFA_AGENT_SEARCH_WINDOW } from "@repo/contents/_types/agent/search";
import type { Infer } from "convex/values";
import { Effect, Option } from "effect";

type ContentSearchInput = Infer<typeof contentSearchInputValidator>;
type TryoutCatalog = Option.Option.Value<
  Effect.Success<ReturnType<typeof findTryoutCatalog>>
>;
type TryoutCatalogEntry = TryoutCatalog["entries"][number];
/** Reads public Tryout search documents from its active signed hierarchy. */
export const readSignedTryoutSearchDocuments = Effect.fn(
  "contents.search.readSignedTryoutDocuments"
)(function* (
  ctx: QueryCtx,
  args: ContentSearchInput,
  queryTexts: readonly string[],
  requestedLimit: number
) {
  const scanLimit = Math.max(
    0,
    Math.min(requestedLimit, NAKAFA_AGENT_SEARCH_WINDOW)
  );
  if (scanLimit === 0) {
    return [];
  }
  const catalog = yield* findTryoutCatalog(ctx, args.locale);
  if (Option.isNone(catalog)) {
    return [];
  }
  const documents = [...catalog.value.entries]
    .sort((left, right) => left.index - right.index)
    .flatMap((entry) => toTryoutSearchDocument(entry, args.locale));
  if (queryTexts.length === 0) {
    return documents.slice(0, scanLimit);
  }
  const groups = queryTexts.map((queryText) =>
    searchTryoutQuery(documents, args.locale, queryText, scanLimit)
  );
  return interleaveSearchGroups(
    groups,
    scanLimit,
    (document) => document.content_id
  );
});
/** Builds one public search document and excludes internal-entry sections. */
function toTryoutSearchDocument(
  entry: TryoutCatalogEntry,
  locale: ContentSearchInput["locale"]
): ContentSearchDocument[] {
  const { row } = entry;
  if (row.publicPath === undefined) {
    return [];
  }
  return [
    buildContentSearchDocument({
      ...row.graph,
      contentHash: entry.rowHash,
      description: row.description,
      locale,
      route: row.publicPath,
      section: "tryout",
      sourcePath: row.publicPath,
      syncedAt: entry.index,
      text: "",
      title: row.title,
    }),
  ];
}
/** Searches one bounded signed catalog through title, description, and route. */
function searchTryoutQuery(
  documents: readonly ContentSearchDocument[],
  locale: ContentSearchInput["locale"],
  queryText: string,
  scanLimit: number
) {
  const exactRoute = getExactRouteQuery(locale, queryText);
  const exact = exactRoute
    ? documents.find(({ route }) => route === exactRoute)
    : undefined;
  const hits = documents.filter((document) =>
    matchesContentSearchQuery(getTryoutSearchText(document), queryText)
  );
  const candidates = exact
    ? [
        exact,
        ...hits.filter((document) => document.content_id !== exact.content_id),
      ]
    : hits;
  return rankContentSearchDocuments(candidates, queryText).slice(0, scanLimit);
}
/** Combines signed display metadata with route tokens for in-memory search. */
function getTryoutSearchText(document: ContentSearchDocument) {
  return [
    document.title,
    document.description,
    getRouteSearchText(document.route),
  ].join(" ");
}
