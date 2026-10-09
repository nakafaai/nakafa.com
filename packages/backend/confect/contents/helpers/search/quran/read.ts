import { QuranSearchRowSchema } from "@nakafa/aksara-contracts/quran/snapshot/row";
import { QuranSurahNumberSchema } from "@nakafa/aksara-contracts/quran/spec";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { quranSearchIdentity } from "@repo/backend/confect/contentRelease/quran/facts";
import { QURAN_SEARCH_RESULT_LIMIT } from "@repo/backend/confect/contentRelease/quran/limits";
import { validateSearchQuery } from "@repo/backend/confect/contentRelease/search/input";
import { buildContentSearchDocument } from "@repo/backend/confect/contents/helpers/search/documents";
import { interleaveSearchGroups } from "@repo/backend/confect/contents/helpers/search/groups";
import { readTextCandidates } from "@repo/backend/confect/contents/helpers/search/quran/candidates";
import { rankContentSearchDocuments } from "@repo/backend/confect/contents/helpers/search/rank";
import type { contentSearchInputValidator } from "@repo/backend/confect/contents/helpers/search/schema";
import {
  getExactRouteQuery,
  getRouteSearchText,
} from "@repo/backend/confect/contents/helpers/search/terms";
import { quranLayer } from "@repo/backend/content/quran/confect";
import { loadQuranOwner } from "@repo/backend/content/quran/owner";
import { readQuranRow } from "@repo/backend/content/quran/row";
import { authenticateQuranSearchHit } from "@repo/backend/content/quran/search";
import {
  Array as Arr,
  Effect,
  HashMap,
  HashSet,
  MutableHashSet,
  Option,
  Schema,
} from "effect";

type ContentSearchInput = typeof contentSearchInputValidator.Type;
const SignedQuranSearchSchema = Schema.Struct({
  index: Schema.Finite,
  payload: QuranSearchRowSchema,
  rowHash: Schema.String,
});
type SignedQuranSearch = typeof SignedQuranSearchSchema.Type;

/** Reads authenticated Quran search documents from the active signed snapshot. */
export const readSignedQuranSearchDocuments = Effect.fn(
  "contents.search.readSignedQuranDocuments"
)(function* (
  args: ContentSearchInput,
  queryTexts: readonly string[],
  requestedLimit: number
) {
  const scanLimit = boundedQuranSearchLimit(requestedLimit);
  if (scanLimit === 0) {
    return [];
  }
  const owner = yield* loadQuranOwner().pipe(Effect.provide(quranLayer));
  if (owner.snapshotId === null) {
    return [];
  }
  if (queryTexts.length === 0) {
    const rows = yield* browseQuranRows(
      owner.snapshotId,
      args.locale,
      scanLimit
    );
    const authenticated = yield* authenticateQuranRows(
      owner.snapshotId,
      rows,
      args.locale
    );
    return Arr.map(authenticated, ({ document }) => document);
  }
  const { exactSurahNumbers, textQueries } = partitionQuranQueries(
    args.locale,
    queryTexts
  );
  const exactDocuments = yield* Effect.forEach(
    Arr.take(exactSurahNumbers, scanLimit),
    (surahNumber) =>
      readSignedQuranSearchDocument(owner.snapshotId, args.locale, surahNumber),
    {
      concurrency: "unbounded",
    }
  );
  const remaining = scanLimit - exactDocuments.length;
  if (remaining === 0 || textQueries.length === 0) {
    return exactDocuments;
  }
  const queries = yield* Effect.forEach(
    textQueries,
    (query) => validateSearchQuery(query),
    {
      concurrency: "unbounded",
    }
  );
  const exactIdentities = HashSet.fromIterable(
    Arr.map(exactSurahNumbers, (surahNumber) =>
      quranSearchIdentity(args.locale, surahNumber)
    )
  );
  const { groups, rows } = yield* readTextCandidates(
    owner.snapshotId,
    args.locale,
    queries,
    exactIdentities,
    exactDocuments.length,
    remaining
  );
  const authenticated = yield* authenticateQuranRows(
    owner.snapshotId,
    rows,
    args.locale
  );
  const documentsByIdentity = HashMap.fromIterable(
    Arr.map(authenticated, ({ document, row }) => [row.identity, document])
  );
  const rankedGroups = Arr.map(groups, ({ query, rows: queryRows }) =>
    rankContentSearchDocuments(
      Arr.flatMap(queryRows, (row) => {
        const document = Option.getOrUndefined(
          HashMap.get(documentsByIdentity, row.identity)
        );
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
  snapshotId: string,
  appLocale: ContentSearchInput["locale"],
  surahNumber: number
) {
  const signed = yield* readQuranRow(
    snapshotId,
    quranSearchIdentity(appLocale, surahNumber),
    QuranSearchRowSchema
  ).pipe(Effect.provide(quranLayer));
  return buildSignedQuranSearchDocument(signed, appLocale);
});

/** Partitions valid exact Quran routes from alternate text expressions. */
function partitionQuranQueries(
  appLocale: ContentSearchInput["locale"],
  queryTexts: readonly string[]
) {
  let exactSurahNumbers: number[] = [];
  const seenExact = MutableHashSet.empty<number>();
  let textQueries: string[] = [];
  for (const queryText of queryTexts) {
    const route = getExactRouteQuery(appLocale, queryText);
    if (!route) {
      textQueries = Arr.append(textQueries, queryText);
      continue;
    }
    const surahNumber = getExactQuranSurah(route);
    if (Option.isNone(surahNumber)) {
      textQueries = Arr.append(textQueries, getRouteSearchText(queryText));
      continue;
    }
    if (MutableHashSet.has(seenExact, surahNumber.value)) {
      continue;
    }
    exactSurahNumbers = Arr.append(exactSurahNumbers, surahNumber.value);
    MutableHashSet.add(seenExact, surahNumber.value);
  }
  return {
    exactSurahNumbers,
    textQueries,
  };
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
const browseQuranRows = Effect.fn("contents.search.browseQuranRows")(function* (
  snapshotId: string,
  appLocale: ContentSearchInput["locale"],
  scanLimit: number
) {
  const database = yield* DatabaseReader;
  return yield* database
    .table("quranSearch")
    .index("by_snapshotId_and_appLocale_and_index", (index) =>
      index.eq("snapshotId", snapshotId).eq("appLocale", appLocale)
    )
    .take(scanLimit)
    .pipe(Effect.orDie);
});
/** Authenticates bounded index hits before exposing their signed graph rows. */
function authenticateQuranRows(
  snapshotId: string,
  rows: readonly Docs["quranSearch"][],
  appLocale: ContentSearchInput["locale"]
) {
  return Effect.forEach(
    rows,
    (row) =>
      authenticateQuranSearchHit(snapshotId, row).pipe(
        Effect.provide(quranLayer),
        Effect.map((signed) => ({
          document: buildSignedQuranSearchDocument(signed, appLocale),
          row,
        }))
      ),
    {
      concurrency: "unbounded",
    }
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
