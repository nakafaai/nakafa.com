import { QuranSurahNumberSchema } from "@nakafa/aksara-contracts/quran/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { quranSearchIdentity } from "@repo/backend/convex/contentRelease/quran/facts";
import { QURAN_SEARCH_RESULT_LIMIT } from "@repo/backend/convex/contentRelease/quran/limits";
import { loadQuranOwner } from "@repo/backend/convex/contentRelease/quran/owner";
import { authenticateQuranSearchHit } from "@repo/backend/convex/contentRelease/quran/search";
import { buildContentSearchDocument } from "@repo/backend/convex/contents/helpers/search/documents";
import {
  type ContentSearchDocument,
  interleaveSearchGroups,
} from "@repo/backend/convex/contents/helpers/search/groups";
import { rankContentSearchDocuments } from "@repo/backend/convex/contents/helpers/search/rank";
import type { contentSearchInputValidator } from "@repo/backend/convex/contents/helpers/search/schema";
import { getExactRouteQuery } from "@repo/backend/convex/contents/helpers/search/terms";
import { getSourceRouteProjectionForRoute } from "@repo/contents/_types/graph/projection";
import type { Infer } from "convex/values";
import { Effect, Option, Schema } from "effect";

type ContentSearchInput = Infer<typeof contentSearchInputValidator>;

/** Reads authenticated Quran search documents from the active signed snapshot. */
export const readSignedQuranSearchDocuments = Effect.fn(
  "contents.search.readSignedQuranDocuments"
)(function* (
  ctx: QueryCtx,
  args: ContentSearchInput,
  queryTexts: readonly string[],
  requestedLimit: number
) {
  const scanLimit = boundedQuranSearchLimit(requestedLimit);
  if (scanLimit === 0) {
    return [];
  }

  const owner = yield* loadQuranOwner(ctx);
  if (owner.snapshotId === null) {
    return [];
  }

  if (queryTexts.length === 0) {
    const rows = yield* browseQuranRows(
      ctx,
      owner.snapshotId,
      args.locale,
      scanLimit
    );
    const authenticated = yield* authenticateQuranRows(
      ctx,
      owner.snapshotId,
      rows
    );
    return authenticated.map(({ document }) => document);
  }

  const groups = yield* Effect.all(
    queryTexts.map((queryText) =>
      searchQuranQuery(
        ctx,
        owner.snapshotId,
        args.locale,
        queryText,
        scanLimit
      ).pipe(Effect.map((rows) => ({ queryText, rows })))
    ),
    { concurrency: "unbounded" }
  );
  const rows = interleaveSearchGroups(
    groups.map(({ rows: groupRows }) => groupRows),
    scanLimit,
    (row) => row._id
  );
  const authenticated = yield* authenticateQuranRows(
    ctx,
    owner.snapshotId,
    rows
  );
  const documentsByRow = new Map(
    authenticated.map(({ document, row }) => [row._id, document])
  );
  const rankedGroups = groups.map(({ queryText, rows: groupRows }) => {
    const documents: ContentSearchDocument[] = [];

    for (const row of groupRows) {
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

/** Searches one Quran query through exact route and signed full-text rows. */
const searchQuranQuery = Effect.fn("contents.search.searchSignedQuranQuery")(
  function* (
    ctx: QueryCtx,
    snapshotId: string,
    locale: ContentSearchInput["locale"],
    queryText: string,
    scanLimit: number
  ) {
    const surahNumber = getExactQuranSurah(locale, queryText);
    const [exact, hits] = yield* Effect.all(
      [
        Option.isNone(surahNumber)
          ? Effect.succeed(null)
          : Effect.promise(() =>
              ctx.db
                .query("quranSearch")
                .withIndex("by_snapshotId_and_identity", (index) =>
                  index
                    .eq("snapshotId", snapshotId)
                    .eq(
                      "identity",
                      quranSearchIdentity(locale, surahNumber.value)
                    )
                )
                .unique()
            ),
        Effect.promise(() =>
          ctx.db
            .query("quranSearch")
            .withSearchIndex("search_text", (search) =>
              search
                .search("text", queryText)
                .eq("snapshotId", snapshotId)
                .eq("locale", locale)
            )
            .take(scanLimit)
        ),
      ],
      { concurrency: "unbounded" }
    );

    if (!exact) {
      return hits;
    }

    return [exact, ...hits.filter((hit) => hit._id !== exact._id)].slice(
      0,
      scanLimit
    );
  }
);

/** Browses one locale in its immutable signed row order. */
function browseQuranRows(
  ctx: QueryCtx,
  snapshotId: string,
  locale: ContentSearchInput["locale"],
  scanLimit: number
) {
  return Effect.promise(() =>
    ctx.db
      .query("quranSearch")
      .withIndex("by_snapshotId_and_locale_and_index", (index) =>
        index.eq("snapshotId", snapshotId).eq("locale", locale)
      )
      .take(scanLimit)
  );
}

/** Authenticates bounded index hits before exposing their signed graph rows. */
function authenticateQuranRows(
  ctx: QueryCtx,
  snapshotId: string,
  rows: readonly Doc<"quranSearch">[]
) {
  return Effect.forEach(
    rows,
    (row) =>
      authenticateQuranSearchHit(ctx, snapshotId, row).pipe(
        Effect.map((signed) => ({
          document: buildContentSearchDocument({
            ...signed.payload.graph,
            contentHash: signed.rowHash,
            locale: signed.payload.locale,
            route: signed.payload.route,
            section: "quran",
            sourcePath: signed.payload.route,
            syncedAt: signed.index,
            text: signed.payload.text,
            title: signed.payload.title,
          }),
          row,
        }))
      ),
    { concurrency: "unbounded" }
  );
}

/** Resolves exact Quran paths through the canonical graph route grammar. */
function getExactQuranSurah(
  locale: ContentSearchInput["locale"],
  queryText: string
) {
  const route = getExactRouteQuery(locale, queryText);
  if (!route) {
    return Option.none();
  }

  const projection = getSourceRouteProjectionForRoute(route);
  if (projection?.kind !== "quran-surah" || !projection.quran) {
    return Option.none();
  }

  const surahNumber = Number(projection.quran.surahSegment);
  return Schema.is(QuranSurahNumberSchema)(surahNumber)
    ? Option.some(surahNumber)
    : Option.none();
}

/** Applies the transaction-proven signed Quran search window. */
function boundedQuranSearchLimit(requestedLimit: number) {
  return Math.max(0, Math.min(requestedLimit, QURAN_SEARCH_RESULT_LIMIT));
}
