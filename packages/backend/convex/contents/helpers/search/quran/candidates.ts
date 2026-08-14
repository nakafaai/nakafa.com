import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import {
  QURAN_SEARCH_DOCUMENT_READ_LIMIT,
  QURAN_SEARCH_RESULT_LIMIT,
} from "@repo/backend/convex/contentRelease/quran/limits";
import { interleaveSearchGroups } from "@repo/backend/convex/contents/helpers/search/groups";
import { Effect } from "effect";

interface TextQueryState {
  exhausted: boolean;
  readonly query: string;
  requested: number;
  readonly rows: Doc<"quranSearch">[];
}

/** Reads fair per-query prefixes while reserving repeated and signed reads. */
export const readTextCandidates = Effect.fn(
  "contents.search.quran.readTextCandidates"
)(function* (
  ctx: QueryCtx,
  snapshotId: string,
  appLocale: AppLocaleCode,
  queries: readonly string[],
  exactIdentities: ReadonlySet<string>,
  exactReadCount: number,
  resultLimit: number
) {
  const states: TextQueryState[] = queries.map((query) => ({
    exhausted: false,
    query,
    requested: 0,
    rows: [],
  }));
  let projectionReadCount = 0;
  const initialReadCount = Math.max(resultLimit, states.length);
  const initialAllocations = allocateReads(states.length, initialReadCount, 0);
  const initialPrefixes = yield* Effect.forEach(
    states,
    (state, index) => {
      const requested = initialAllocations[index] ?? 1;
      return searchText(
        ctx,
        snapshotId,
        appLocale,
        state.query,
        requested
      ).pipe(Effect.map((rows) => ({ requested, rows, state })));
    },
    { concurrency: "unbounded" }
  );
  for (const { requested, rows, state } of initialPrefixes) {
    projectionReadCount += rows.length;
    replaceRows(state, requested, rows, exactIdentities);
  }

  let candidates = selectCandidates(states, resultLimit);
  let expansionStart = 0;
  while (candidates.length < resultLimit) {
    const active = states.filter(
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
      ctx,
      snapshotId,
      appLocale,
      expansion.state.query,
      expansion.requested
    );
    projectionReadCount += rows.length;
    replaceRows(expansion.state, expansion.requested, rows, exactIdentities);
    candidates = selectCandidates(states, resultLimit);
    expansionStart = expansion.nextStart;
  }

  return {
    groups: states.map(({ query, rows }) => ({ query, rows })),
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
  for (let offset = 0; offset < states.length; offset += 1) {
    const index = (start + offset) % states.length;
    const state = states[index];
    if (!state) {
      continue;
    }

    const requested = getMaximumRequestedRows(
      state.requested,
      availableDocumentReads,
      missingResultCount
    );
    if (requested > state.requested) {
      return {
        nextStart: (index + 1) % states.length,
        requested,
        state,
      };
    }
  }

  return null;
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
function searchText(
  ctx: QueryCtx,
  snapshotId: string,
  appLocale: AppLocaleCode,
  query: string,
  requested: number
) {
  return Effect.promise(() =>
    ctx.db
      .query("quranSearch")
      .withSearchIndex("search_text", (search) =>
        search
          .search("text", query)
          .eq("snapshotId", snapshotId)
          .eq("appLocale", appLocale)
      )
      .take(requested)
  );
}

/** Replaces one query prefix and records whether its range is exhausted. */
function replaceRows(
  state: TextQueryState,
  requested: number,
  rows: readonly Doc<"quranSearch">[],
  exactIdentities: ReadonlySet<string>
) {
  state.exhausted = rows.length < requested;
  state.requested = requested;
  state.rows.splice(
    0,
    state.rows.length,
    ...rows.filter((row) => !exactIdentities.has(row.identity))
  );
}

/** Selects unique candidates fairly across independently ranked indexes. */
function selectCandidates(states: readonly TextQueryState[], limit: number) {
  return interleaveSearchGroups(
    states.map(({ rows }) => rows),
    limit,
    (row) => row.identity
  );
}

/** Distributes one bounded read allowance fairly from a rotating start. */
function allocateReads(count: number, total: number, start: number) {
  const allocations = Array.from({ length: count }, () =>
    Math.floor(total / count)
  );
  const remainder = total % count;

  for (let offset = 0; offset < remainder; offset += 1) {
    const index = (start + offset) % count;
    allocations[index] = (allocations[index] ?? 0) + 1;
  }

  return allocations;
}
