import { decodeAgentOutput } from "@repo/backend/agent/decode";
import { searchNakafaContent } from "@repo/backend/agent/search";
import {
  fuseRanks,
  placeOf,
} from "@repo/backend/confect/contents/sections/fuse";
import type { Hit } from "@repo/backend/confect/contents/sections/hits.spec";
import { searchSections } from "@repo/backend/confect/contents/sections/search";
import { READ_START_SECTION } from "@repo/backend/confect/contents/sections/split";
import {
  formatSearchGroup,
  getSearchTokens,
  rankSearchResult,
} from "@repo/backend/confect/nina/nakafa/search";
import {
  type NakafaAgentSearchFactsSchema,
  NakafaAgentSearchResultSchema,
} from "@repo/contents/agent/schema/search";
import {
  NAKAFA_AGENT_MAX_LIMIT,
  NAKAFA_AGENT_MAX_OFFSET,
} from "@repo/contents/agent/search";
import {
  Array as Arr,
  Cause,
  Effect,
  Exit,
  Option,
  String as Str,
} from "effect";

type SearchFacts = typeof NakafaAgentSearchFactsSchema.Type;

/**
 * One result and where to read it: the reference of its document, what it
 * says, and the section to start at. A section found by meaning or by words is
 * one; so is a try-out, which has no sections and is read from its start.
 */
type Entry = Pick<Hit, "anchor" | "excerpt" | "headingPath" | "reference">;

/** Documents one question asks the index for. The index gives the best section of each. */
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
 * The try-outs that the words of the questions find. A try-out is a catalog
 * entry with no text to embed, so no section search finds it, and a search
 * over all kinds of content must still show it among the lessons.
 */
const findTryouts = Effect.fn("nakafa.findTryouts")(function* (
  input: SearchFacts,
  queries: string[]
) {
  const result = rankSearchResult(
    yield* searchNakafaContent({
      ...input,
      limit: NAKAFA_AGENT_MAX_LIMIT,
      offset: 0,
      section: "tryout",
    }),
    getSearchTokens(queries)
  );
  return Arr.map(
    result.items,
    ({ excerpt, ...reference }): Entry => ({
      anchor: READ_START_SECTION,
      excerpt,
      headingPath: [],
      reference,
    })
  );
});

/**
 * Finds the sections that answer each question, merges the answers into one
 * ranking, and keeps the best section of a document that several questions
 * found. A search over all
 * kinds of content adds the try-outs that the words find, ranked among the
 * sections. The answer is none when the index gave no answer to any question,
 * so that the caller can search by words.
 */
const findBySections = Effect.fn("nakafa.findBySections")(function* (
  input: SearchFacts,
  queries: string[]
) {
  const [answers, tryouts] = yield* Effect.all(
    [
      Effect.forEach(
        queries,
        (query) =>
          searchSections({
            limit: SECTION_CANDIDATES,
            locale: input.locale,
            query,
            ...(input.section === undefined ? {} : { section: input.section }),
          }),
        { concurrency: "unbounded" }
      ),
      input.section === undefined
        ? findTryouts(input, queries)
        : Effect.succeed<readonly Entry[]>([]),
    ],
    { concurrency: "unbounded" }
  );
  const lists = Arr.flatMap(answers, (answer) =>
    answer.kind === "hits" ? [answer.hits] : []
  );
  if (Arr.isReadonlyArrayEmpty(lists)) {
    return Option.none<readonly Entry[]>();
  }
  const sections = Arr.dedupeWith(
    fuseRanks(lists, placeOf),
    (left, right) => left.reference.content_id === right.reference.content_id
  );
  return Option.some(
    fuseRanks<Entry>(
      [sections, tryouts],
      ({ reference }) => reference.content_id
    )
  );
});

/** The headings that lead to a section, as one line. */
function headings({ headingPath }: Entry) {
  return Arr.join(headingPath, " > ");
}

/** Shapes one page of the best results as the result that the tool and its display share. */
const resultOf = Effect.fn("nakafa.resultOf")(function* (
  input: SearchFacts,
  page: readonly Entry[],
  total: number
) {
  const next = input.offset + page.length;
  const hasMore = total > next && next <= NAKAFA_AGENT_MAX_OFFSET;
  return yield* decodeAgentOutput(
    NakafaAgentSearchResultSchema,
    {
      count: page.length,
      has_more: hasMore,
      items: Arr.map(page, (entry) => ({
        ...entry.reference,
        excerpt: Arr.join(
          Arr.filter([headings(entry), entry.excerpt], Str.isNonEmpty),
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
 * that the read tool takes, or the start of the document for an introduction
 * or a try-out.
 */
function pointers(page: readonly Entry[]) {
  return Arr.join(
    [
      "# Matching Sections",
      ...Arr.map(page, (entry, index) => {
        const path = headings(entry);
        return path === ""
          ? `- Result ${index + 1}: the start of the document`
          : `- Result ${index + 1}: ${path} (read section: ${entry.anchor})`;
      }),
    ],
    "\n"
  );
}

/**
 * Searches Nakafa content for a question. Lessons, articles, and the Quran are
 * searched by meaning and by words at once, in sections, so a result names the
 * section that answers and not only the document that holds it. A search over
 * all kinds of content adds the try-outs that the words find, because a
 * try-out has no text to search by meaning. A try-out search, a search with no
 * question, an index that gives no answer, and any failure of the index fall
 * back to the word search, so Nina is never left without a search.
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
    yield* Effect.logInfo(
      "The section index gave no answer; using the word search."
    );
    return yield* findByWords(input);
  }
  const entries = found.value.value;
  const page = Arr.take(Arr.drop(entries, input.offset), input.limit);
  const result = yield* resultOf(input, page, entries.length);
  return {
    result,
    text: `${formatSearchGroup(input, result)}\n\n${pointers(page)}`,
  };
});
