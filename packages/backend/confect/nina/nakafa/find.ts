import { decodeAgentOutput } from "@repo/backend/agent/decode";
import { searchNakafaContent } from "@repo/backend/agent/search";
import { fuseRanks } from "@repo/backend/confect/contents/sections/fuse";
import type { Hit } from "@repo/backend/confect/contents/sections/hits.spec";
import { searchSections } from "@repo/backend/confect/contents/sections/search";
import {
  formatSearchGroup,
  getSearchTokens,
  rankSearchResult,
} from "@repo/backend/confect/nina/nakafa/search";
import {
  type NakafaAgentSearchFactsSchema,
  NakafaAgentSearchResultSchema,
} from "@repo/contents/agent/schema/search";
import { NAKAFA_AGENT_MAX_OFFSET } from "@repo/contents/agent/search";
import {
  Array as Arr,
  Cause,
  Effect,
  Exit,
  Option,
  String as Str,
} from "effect";

type SearchFacts = typeof NakafaAgentSearchFactsSchema.Type;

/** Sections one question asks the index for, before the best section of each document is kept. */
const SECTION_CANDIDATES = 20;

/** The word search of Nakafa content, ranked and formatted for the specialist. */
const findByWords = Effect.fn("nakafa.findByWords")(function* (
  input: SearchFacts
) {
  const result = rankSearchResult(
    yield* searchNakafaContent(input),
    getSearchTokens(input.queries ?? [])
  );
  return { result, text: formatSearchGroup(input, result) };
});

/**
 * Finds the sections that answer each question, merges the answers into one
 * ranking, and keeps the best section of each document. The answer is none
 * when the index holds no section, so that the caller can search by words.
 */
const findBySections = Effect.fn("nakafa.findBySections")(function* (
  input: SearchFacts,
  queries: readonly string[]
) {
  const answers = yield* Effect.forEach(
    queries,
    (query) =>
      searchSections({
        limit: SECTION_CANDIDATES,
        locale: input.locale,
        query,
        ...(input.section === undefined ? {} : { section: input.section }),
      }),
    { concurrency: "unbounded" }
  );
  const lists = Arr.flatMap(answers, (answer) =>
    answer.kind === "hits" ? [answer.hits] : []
  );
  if (Arr.isReadonlyArrayEmpty(lists)) {
    return Option.none<readonly Hit[]>();
  }
  return Option.some(
    Arr.dedupeWith(
      fuseRanks(lists, ({ contentKey, ordinal }) => `${contentKey}#${ordinal}`),
      (left, right) => left.reference.content_id === right.reference.content_id
    )
  );
});

/** The headings that lead to a section, as one line. */
function headings({ headingPath }: Hit) {
  return Arr.join(headingPath, " > ");
}

/** Shapes one page of the best sections as the result that the tool and its display share. */
const resultOf = Effect.fn("nakafa.resultOf")(function* (
  input: SearchFacts,
  page: readonly Hit[],
  total: number
) {
  const next = input.offset + page.length;
  const hasMore = total > next && next <= NAKAFA_AGENT_MAX_OFFSET;
  return yield* decodeAgentOutput(
    NakafaAgentSearchResultSchema,
    {
      count: page.length,
      has_more: hasMore,
      items: Arr.map(page, (hit) => ({
        ...hit.reference,
        excerpt: Arr.join(
          Arr.filter([headings(hit), hit.excerpt], Str.isNonEmpty),
          ": "
        ),
      })),
      limit: input.limit,
      offset: input.offset,
      ...(hasMore ? { next_offset: next } : {}),
    },
    "Nakafa section search returned invalid data."
  );
});

/**
 * Tells the specialist where to read each result: the section of the document
 * that the read tool takes, or the start of the document for an introduction.
 */
function pointers(page: readonly Hit[]) {
  return Arr.join(
    [
      "# Matching Sections",
      ...Arr.map(page, (hit, index) => {
        const path = headings(hit);
        return path === ""
          ? `- Result ${index + 1}: the start of the document`
          : `- Result ${index + 1}: ${path} (read section: ${hit.anchor})`;
      }),
    ],
    "\n"
  );
}

/**
 * Searches Nakafa content for a question. Lessons, articles, and the Quran are
 * searched by meaning and by words at once, in sections, so a result names the
 * section that answers and not only the document that holds it. Try-out
 * discovery, a search with no question, an empty index, and any failure of the
 * index fall back to the word search, so Nina is never left without a search.
 */
export const findContent = Effect.fn("nakafa.findContent")(function* (
  input: SearchFacts
) {
  const queries = input.queries ?? [];
  if (input.section === "tryout" || Arr.isReadonlyArrayEmpty(queries)) {
    return yield* findByWords(input);
  }
  // A failure the search names, or a defect of the vector search, which
  // reports its failures as defects: both leave the word search to answer.
  const found = yield* Effect.exit(findBySections(input, queries));
  if (Exit.isFailure(found)) {
    yield* Effect.logWarning(
      "The section search failed; using the word search."
    ).pipe(
      Effect.annotateLogs({
        failure: Option.match(Cause.findErrorOption(found.cause), {
          onNone: () => "defect",
          onSome: ({ _tag }) => _tag,
        }),
      })
    );
    return yield* findByWords(input);
  }
  if (Option.isNone(found.value)) {
    yield* Effect.logInfo("The section index is empty; using the word search.");
    return yield* findByWords(input);
  }
  const hits = found.value.value;
  const page = Arr.take(Arr.drop(hits, input.offset), input.limit);
  const result = yield* resultOf(input, page, hits.length);
  return {
    result,
    text: `${formatSearchGroup(input, result)}\n\n${pointers(page)}`,
  };
});
