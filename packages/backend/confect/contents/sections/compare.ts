import refs from "@repo/backend/confect/_generated/refs";
import { QueryRunner } from "@repo/backend/confect/_generated/services";
import type { compareInputValidator } from "@repo/backend/confect/contents/sections/compare.spec";
import { embedBatch } from "@repo/backend/confect/contents/sections/embed";
import {
  COMPARE_CONCURRENCY,
  EMBED_BATCH_SIZE,
} from "@repo/backend/confect/contents/sections/limits";
import type { pageResultValidator } from "@repo/backend/confect/contents/sections/schema";
import { Gateway } from "@repo/backend/confect/gateway/handle";
import {
  Array as Arr,
  Duration,
  Effect,
  Number as Num,
  Option,
  Stream,
} from "effect";

type Input = typeof compareInputValidator.Type;
type Question = Input["questions"][number];
type Stored = (typeof pageResultValidator.Type)["sections"][number];

/** A stored section that the model embedded, with its vector scaled to length one. */
type Entry = readonly [Stored, readonly number[]];

/** Reads every stored section of a language, a page at a time. */
const storedSections = Effect.fn("contents.sections.storedSections")(function* (
  appLocale: Input["locale"]
) {
  const { runQuery } = yield* QueryRunner;
  return yield* Stream.runCollect(
    Stream.paginate<string | null, Stored>(null, (cursor) =>
      runQuery(refs.internal.contents.sections.rows.page, {
        appLocale,
        cursor,
      }).pipe(
        Effect.catchTag("SchemaError", Effect.die),
        Effect.map(
          (page) => [page.sections, Option.fromNullishOr(page.next)] as const
        )
      )
    )
  );
});

/** The vector scaled to length one, so that the dot product of two is their cosine. */
function unit(vector: readonly number[]) {
  const length = Math.sqrt(
    Arr.reduce(vector, 0, (sum, value) => sum + value * value)
  );
  return Arr.map(vector, (value) => value / length);
}

/** The dot product of two vectors of the same length. */
function dot(left: readonly number[], right: readonly number[]) {
  return Num.sumAll(Arr.zipWith(left, right, (a, b) => a * b));
}

/** Whether a stored section is the one that a question names. */
function isNamedBy(question: Question) {
  return (section: Stored) =>
    section.contentKey === question.contentKey &&
    section.ordinal === question.ordinal;
}

/**
 * Where the section that a question names ranks among the embedded sections by
 * cosine similarity to the question, and its heading. A section ranks after as
 * many sections as are closer to the question than it is. A section that the
 * model would not embed cannot be found with this model, as a build with it
 * would leave that section out of the index, so it ranks after every section
 * that was embedded.
 */
function standing(
  sections: readonly Stored[],
  entries: readonly Entry[],
  query: readonly number[],
  question: Question
) {
  return Option.map(
    Arr.findFirst(sections, isNamedBy(question)),
    (section) => ({
      heading: Option.getOrElse(Arr.last(section.headingPath), () => ""),
      rank: Option.match(
        Arr.findFirst(entries, ([entry]) => isNamedBy(question)(entry)),
        {
          onNone: () => entries.length + 1,
          onSome: ([, vector]) => {
            const own = dot(query, vector);
            return (
              1 +
              Arr.length(
                Arr.filter(entries, ([, other]) => dot(query, other) > own)
              )
            );
          },
        }
      ),
    })
  );
}

/**
 * Embeds every stored section of a language and then each question, one at a
 * time so that its latency is its own, with one candidate model, and tells
 * where the section each question names ranks among them. The sections are
 * embedded as the build embeds them, a section whose text the model refuses is
 * left out and counted, and a model that refuses all of a batch fails the run.
 * The answer is `empty` when no section of the language is stored.
 */
export const rankQuestions = Effect.fn("contents.sections.rankQuestions")(
  function* (input: Input) {
    const gateway = yield* Gateway;
    const sections = yield* storedSections(input.locale);
    if (Arr.isReadonlyArrayEmpty(sections)) {
      return { kind: "empty" as const };
    }
    const vectors = Arr.flatten(
      yield* Effect.forEach(
        Arr.chunksOf(sections, EMBED_BATCH_SIZE),
        (batch) =>
          embedBatch(
            Arr.map(batch, (section) => ({
              ...section,
              appLocale: input.locale,
            })),
            input.model
          ),
        { concurrency: COMPARE_CONCURRENCY }
      )
    );
    const entries = Arr.getSomes(
      Arr.zipWith(sections, vectors, (section, vector) =>
        Option.map(vector, (found): Entry => [section, unit(found)])
      )
    );
    const verdicts = Arr.flatten(
      yield* Effect.forEach(input.questions, (question) =>
        Effect.map(
          Effect.timed(gateway.embed([question.question], input.model)),
          ([duration, embeddings]) =>
            Arr.map(embeddings, (embedding) => ({
              milliseconds: Duration.toMillis(duration),
              section: Option.getOrNull(
                standing(sections, entries, unit(embedding), question)
              ),
            }))
        )
      )
    );
    return {
      kind: "ranked" as const,
      pool: entries.length,
      refused: sections.length - entries.length,
      verdicts,
    };
  }
);
