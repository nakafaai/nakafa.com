import refs from "@repo/backend/confect/_generated/refs";
import {
  QueryRunner,
  VectorSearch,
} from "@repo/backend/confect/_generated/services";
import {
  CANDIDATES_PER_LEG,
  SEARCH_DEADLINE_MS,
  SEARCH_DEFAULT_LIMIT,
} from "@repo/backend/confect/contents/sections/limits";
import {
  INDEXED_SECTIONS,
  sectionScope,
} from "@repo/backend/confect/contents/sections/schema";
import type { searchInputValidator } from "@repo/backend/confect/contents/sections/search.spec";
import { GatewayFailure } from "@repo/backend/confect/gateway/failure";
import { Gateway } from "@repo/backend/confect/gateway/handle";
import { Array as Arr, Duration, Effect } from "effect";

/**
 * Finds the sections that answer a question, by meaning and by words, merged
 * into one ranking and given in the language of the learner. The index is
 * asked first whether it may answer. While it may not, because its build for
 * the active release has not finished, the answer is `empty` and the question
 * goes neither to the embedder nor to the vector search. Otherwise the
 * question is embedded once; the nearest sections of the learner's language
 * are found by vector search, which only an action can run, and the rest is
 * finished in one query. The search ends with a timeout failure if it takes
 * longer than its deadline, so a caller can fall back to another search.
 */
export const searchSections = Effect.fn("contents.sections.search")(
  function* (input: typeof searchInputValidator.Type) {
    const { runQuery } = yield* QueryRunner;
    const ready = yield* runQuery(
      refs.internal.contents.sections.state.ready,
      {}
    ).pipe(Effect.catchTag("SchemaError", Effect.die));
    if (!ready) {
      return { kind: "empty" as const };
    }
    const gateway = yield* Gateway;
    const vectorSearch = yield* VectorSearch;
    const embeddings = yield* gateway.embed([input.query]);
    const found = Arr.flatten(
      yield* Effect.forEach(embeddings, (vector) =>
        vectorSearch("contentSections", "by_embedding", {
          filter: (filter) =>
            filter.or(
              ...Arr.map(
                input.section === undefined
                  ? INDEXED_SECTIONS
                  : [input.section],
                (section) =>
                  filter.eq("scope", sectionScope(input.locale, section))
              )
            ),
          limit: CANDIDATES_PER_LEG,
          vector: Arr.fromIterable(vector),
        })
      )
    );
    return yield* runQuery(refs.internal.contents.sections.hits.resolve, {
      ids: Arr.map(found, ({ _id }) => _id),
      limit: input.limit ?? SEARCH_DEFAULT_LIMIT,
      locale: input.locale,
      query: input.query,
      ...(input.section === undefined ? {} : { section: input.section }),
    }).pipe(Effect.catchTag("SchemaError", Effect.die));
  },
  Effect.timeoutOrElse({
    duration: Duration.millis(SEARCH_DEADLINE_MS),
    orElse: () => Effect.fail(new GatewayFailure({ reason: "timeout" })),
  })
);
