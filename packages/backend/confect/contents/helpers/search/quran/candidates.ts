import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import quranSearchTable from "@repo/backend/confect/_generated/tables/quranSearch";
import {
  QURAN_SEARCH_DOCUMENT_READ_LIMIT,
  QURAN_SEARCH_RESULT_LIMIT,
} from "@repo/backend/confect/contentRelease/quran/limits";
import { interleaveSearchGroups } from "@repo/backend/confect/contents/helpers/search/groups";
import { Array as Arr, Effect, HashSet, Option, Schema } from "effect";

const TextQueryStateSchema = Schema.Struct({
  exhausted: Schema.Boolean,
  query: Schema.String,
  requested: Schema.Finite,
  rows: Schema.Array(quranSearchTable.Doc),
});
type TextQueryState = typeof TextQueryStateSchema.Type;

/** Reads fair per-query prefixes while reserving repeated and signed reads. */
export const readTextCandidates = Effect.fn(
  "contents.search.quran.readTextCandidates"
)(function* (
  snapshotId: string,
  appLocale: AppLocaleCode,
  queries: readonly string[],
  exactIdentities: HashSet.HashSet<string>,
  exactReadCount: number,
  resultLimit: number
) {
  const initialReadCount = Math.max(resultLimit, queries.length);
  let states: readonly TextQueryState[] = Arr.map(queries, (query, index) => ({
    exhausted: false,
    query,
    requested:
      Math.floor(initialReadCount / queries.length) +
      Number(index < initialReadCount % queries.length),
    rows: [],
  }));
  let projectionReadCount = 0;
  const initialPrefixes = yield* Effect.forEach(
    states,
    (state) => {
      const requested = state.requested;
      return searchText(snapshotId, appLocale, state.query, requested).pipe(
        Effect.map((rows) => ({
          requested,
          rows,
          state,
        }))
      );
    },
    {
      concurrency: "unbounded",
    }
  );
  for (const { rows } of initialPrefixes) {
    projectionReadCount += rows.length;
  }
  states = Arr.map(initialPrefixes, ({ requested, rows, state }) =>
    replaceRows(state, requested, rows, exactIdentities)
  );
  let candidates = selectCandidates(states, resultLimit);
  let expansionStart = 0;
  while (candidates.length < resultLimit) {
    const active = Arr.filter(
      states,
      (state) => !state.exhausted && state.requested < QURAN_SEARCH_RESULT_LIMIT
    );
    if (active.length === 0) {
      break;
    }
    const availableDocumentReads =
      QURAN_SEARCH_DOCUMENT_READ_LIMIT -
      exactReadCount -
      projectionReadCount -
      candidates.length;
    const expansion = getExpansion(
      active,
      expansionStart,
      availableDocumentReads,
      resultLimit - candidates.length
    );
    if (!expansion) {
      break;
    }
    const rows = yield* searchText(
      snapshotId,
      appLocale,
      expansion.state.query,
      expansion.requested
    );
    projectionReadCount += rows.length;
    const expanded = replaceRows(
      expansion.state,
      expansion.requested,
      rows,
      exactIdentities
    );
    states = Arr.map(states, (state) =>
      state === expansion.state ? expanded : state
    );
    candidates = selectCandidates(states, resultLimit);
    expansionStart = expansion.nextStart;
  }
  return {
    groups: Arr.map(states, ({ query, rows }) => ({
      query,
      rows,
    })),
    rows: candidates,
  };
});

/** Finds the next query prefix that fits repeated and authentication reads. */
function getExpansion(
  states: readonly TextQueryState[],
  start: number,
  availableDocumentReads: number,
  missingResultCount: number
) {
  const first = start % states.length;
  const rotated = [...Arr.drop(states, first), ...Arr.take(states, first)];
  return Option.getOrNull(
    Arr.findFirst(rotated, (state, offset) => {
      const index = (first + offset) % states.length;
      const requested = getMaximumRequestedRows(
        state.requested,
        availableDocumentReads,
        missingResultCount
      );
      return requested > state.requested
        ? Option.some({
            nextStart: (index + 1) % states.length,
            requested,
            state,
          })
        : Option.none();
    })
  );
}

/** Uses every safe prefix row so an overlapping retry cannot strand capacity. */
function getMaximumRequestedRows(
  previousRequest: number,
  availableDocumentReads: number,
  missingResultCount: number
) {
  let requested = previousRequest;
  for (
    let candidate = previousRequest + 1;
    candidate <= QURAN_SEARCH_RESULT_LIMIT;
    candidate += 1
  ) {
    const possibleNewResults = Math.min(
      missingResultCount,
      candidate - previousRequest
    );
    if (candidate + possibleNewResults > availableDocumentReads) {
      break;
    }
    requested = candidate;
  }
  return requested;
}

/** Searches one full variant without changing its final-term prefix behavior. */
const searchText = Effect.fn("contents.search.searchText")(function* (
  snapshotId: string,
  appLocale: AppLocaleCode,
  query: string,
  requested: number
) {
  const database = yield* DatabaseReader;
  return yield* database
    .table("quranSearch")
    .search("search_text", (search) =>
      search
        .search("text", query)
        .eq("snapshotId", snapshotId)
        .eq("appLocale", appLocale)
    )
    .take(requested)
    .pipe(Effect.orDie);
});
/** Returns one query prefix with its new rows and whether its range is exhausted. */
function replaceRows(
  state: TextQueryState,
  requested: number,
  rows: TextQueryState["rows"],
  exactIdentities: HashSet.HashSet<string>
): TextQueryState {
  return {
    ...state,
    exhausted: rows.length < requested,
    requested,
    rows: Arr.filter(
      rows,
      (row) => !HashSet.has(exactIdentities, row.identity)
    ),
  };
}

/** Selects unique candidates fairly across independently ranked indexes. */
function selectCandidates(states: readonly TextQueryState[], limit: number) {
  return interleaveSearchGroups(
    Arr.map(states, ({ rows }) => rows),
    limit,
    (row) => row.identity
  );
}
