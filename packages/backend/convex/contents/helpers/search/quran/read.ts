import { QuranSearchRowSchema } from "@nakafa/aksara-contracts/quran/snapshot/row";
import { QuranSurahNumberSchema } from "@nakafa/aksara-contracts/quran/spec";
import { convexQuranLayer } from "@repo/backend/content/quran/convex";
import { loadQuranOwner } from "@repo/backend/content/quran/owner";
import { readQuranRow } from "@repo/backend/content/quran/row";
import { authenticateQuranSearchHit } from "@repo/backend/content/quran/search";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { quranSearchIdentity } from "@repo/backend/convex/contentRelease/quran/facts";
import { QURAN_SEARCH_RESULT_LIMIT } from "@repo/backend/convex/contentRelease/quran/limits";
import { validateSearchQuery } from "@repo/backend/convex/contentRelease/search/input";
import { buildContentSearchDocument } from "@repo/backend/convex/contents/helpers/search/documents";
import { interleaveSearchGroups } from "@repo/backend/convex/contents/helpers/search/groups";
import { readTextCandidates } from "@repo/backend/convex/contents/helpers/search/quran/candidates";
import { rankContentSearchDocuments } from "@repo/backend/convex/contents/helpers/search/rank";
import type { contentSearchInputValidator } from "@repo/backend/convex/contents/helpers/search/schema";
import {
  getExactRouteQuery,
  getRouteSearchText,
} from "@repo/backend/convex/contents/helpers/search/terms";
import type { Infer } from "convex/values";
import { Effect, Option, Schema } from "effect";

type ContentSearchInput = Infer<typeof contentSearchInputValidator>;
interface SignedQuranSearch {
  readonly index: number;
  readonly payload: typeof QuranSearchRowSchema.Type;
  readonly rowHash: string;
}

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

  const owner = yield* loadQuranOwner().pipe(
    Effect.provide(convexQuranLayer(ctx))
  );
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
      rows,
      args.locale
    );
    return authenticated.map(({ document }) => document);
  }

  const { exactSurahNumbers, textQueries } = partitionQuranQueries(
    args.locale,
    queryTexts
  );
  const exactDocuments = yield* Effect.forEach(
    exactSurahNumbers.slice(0, scanLimit),
    (surahNumber) =>
      readSignedQuranSearchDocument(
        ctx,
        owner.snapshotId,
        args.locale,
        surahNumber
      ),
    { concurrency: "unbounded" }
  );
  const remaining = scanLimit - exactDocuments.length;
  if (remaining === 0 || textQueries.length === 0) {
    return exactDocuments;
  }

  const queries = yield* Effect.forEach(
    textQueries,
    (query) => validateSearchQuery(query),
    { concurrency: "unbounded" }
  );
  const exactIdentities = new Set(
    exactSurahNumbers.map((surahNumber) =>
      quranSearchIdentity(args.locale, surahNumber)
    )
  );
  const { groups, rows } = yield* readTextCandidates(
    ctx,
    owner.snapshotId,
    args.locale,
    queries,
    exactIdentities,
    exactDocuments.length,
    remaining
  );
  const authenticated = yield* authenticateQuranRows(
    ctx,
    owner.snapshotId,
    rows,
    args.locale
  );
  const documentsByIdentity = new Map(
    authenticated.map(({ document, row }) => [row.identity, document])
  );
  const rankedGroups = groups.map(({ query, rows: queryRows }) =>
    rankContentSearchDocuments(
      queryRows.flatMap((row) => {
        const document = documentsByIdentity.get(row.identity);
        return document ? [document] : [];
      }),
      query
    )
  );

  return [
    ...exactDocuments,
    ...interleaveSearchGroups(
      rankedGroups,
      remaining,
      (document) => document.content_id
    ),
  ];
});

/** Reads one exact signed search row without consulting its text projection. */
const readSignedQuranSearchDocument = Effect.fn(
  "contents.search.readSignedQuranSearchDocument"
)(function* (
  ctx: QueryCtx,
  snapshotId: string,
  appLocale: ContentSearchInput["locale"],
  surahNumber: number
) {
  const signed = yield* readQuranRow(
    snapshotId,
    quranSearchIdentity(appLocale, surahNumber),
    QuranSearchRowSchema
  ).pipe(Effect.provide(convexQuranLayer(ctx)));
  return buildSignedQuranSearchDocument(signed, appLocale);
});

/** Partitions valid exact Quran routes from alternate text expressions. */
function partitionQuranQueries(
  appLocale: ContentSearchInput["locale"],
  queryTexts: readonly string[]
) {
  const exactSurahNumbers: number[] = [];
  const seenExact = new Set<number>();
  const textQueries: string[] = [];

  for (const queryText of queryTexts) {
    const route = getExactRouteQuery(appLocale, queryText);
    if (!route) {
      textQueries.push(queryText);
      continue;
    }

    const surahNumber = getExactQuranSurah(route);
    if (Option.isNone(surahNumber)) {
      textQueries.push(getRouteSearchText(queryText));
      continue;
    }
    if (seenExact.has(surahNumber.value)) {
      continue;
    }

    exactSurahNumbers.push(surahNumber.value);
    seenExact.add(surahNumber.value);
  }

  return { exactSurahNumbers, textQueries };
}

/** Builds one public search document from an authenticated signed payload. */
function buildSignedQuranSearchDocument(
  signed: SignedQuranSearch,
  appLocale: ContentSearchInput["locale"]
) {
  return buildContentSearchDocument({
    ...signed.payload.graph,
    contentHash: signed.rowHash,
    hasMarkdownSource: true,
    locale: appLocale,
    route: signed.payload.route,
    section: "quran",
    sourcePath: signed.payload.route,
    syncedAt: signed.index,
    text: signed.payload.text,
    title: signed.payload.title,
  });
}

/** Browses one locale in its immutable signed row order. */
function browseQuranRows(
  ctx: QueryCtx,
  snapshotId: string,
  appLocale: ContentSearchInput["locale"],
  scanLimit: number
) {
  return Effect.promise(() =>
    ctx.db
      .query("quranSearch")
      .withIndex("by_snapshotId_and_appLocale_and_index", (index) =>
        index.eq("snapshotId", snapshotId).eq("appLocale", appLocale)
      )
      .take(scanLimit)
  );
}

/** Authenticates bounded index hits before exposing their signed graph rows. */
function authenticateQuranRows(
  ctx: QueryCtx,
  snapshotId: string,
  rows: readonly Doc<"quranSearch">[],
  appLocale: ContentSearchInput["locale"]
) {
  return Effect.forEach(
    rows,
    (row) =>
      authenticateQuranSearchHit(snapshotId, row).pipe(
        Effect.provide(convexQuranLayer(ctx)),
        Effect.map((signed) => ({
          document: buildSignedQuranSearchDocument(signed, appLocale),
          row,
        }))
      ),
    { concurrency: "unbounded" }
  );
}

/** Resolves one exact canonical Quran route. */
function getExactQuranSurah(route: string) {
  const [namespace, surahSegment, extra] = route.split("/");
  if (
    namespace !== "quran" ||
    surahSegment === undefined ||
    extra !== undefined
  ) {
    return Option.none();
  }

  const surahNumber = Number(surahSegment);
  return Schema.is(QuranSurahNumberSchema)(surahNumber)
    ? Option.some(surahNumber)
    : Option.none();
}

/** Applies the transaction-proven signed Quran search window. */
function boundedQuranSearchLimit(requestedLimit: number) {
  return Math.max(0, Math.min(requestedLimit, QURAN_SEARCH_RESULT_LIMIT));
}
