import { QURAN_SURAH_COUNT } from "@nakafa/aksara-contracts/quran/spec";
import refs from "@repo/backend/confect/_generated/refs";
import {
  MutationRunner,
  QueryRunner,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import {
  documentSections,
  embedInput,
} from "@repo/backend/confect/contents/sections/draft";
import {
  EMBED_BATCH_SIZE,
  SECTIONS_PER_MUTATION,
} from "@repo/backend/confect/contents/sections/limits";
import type {
  lessonValidator,
  Position,
  SectionFields,
  stepInputValidator,
} from "@repo/backend/confect/contents/sections/schema";
import { Gateway } from "@repo/backend/confect/gateway/handle";
import { embeddingModelId } from "@repo/backend/confect/gateway/model";
import { projectMdxForAgentMarkdown } from "@repo/contents/llms/mdx";
import { sha256Hex } from "@repo/utilities/digest";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Duration, Effect, Match } from "effect";

const START = { cursor: null, phase: "lessons" } satisfies Position;
const NOTHING = { embedded: 0, kept: 0, missing: 0, written: 0 };

/**
 * Splits one lesson into sections, from the same agent markdown that a reader
 * of the lesson gets, so that the anchor of a section opens it when it is read.
 * A lesson whose source cannot be projected is skipped with a warning, because
 * the same lesson fails the same way on every run and must not stop the build.
 */
const lessonSections = Effect.fn("contents.sections.lessonSections")(function* (
  lesson: typeof lessonValidator.Type
) {
  const { rawMdx, title, ...source } = lesson;
  return yield* projectMdxForAgentMarkdown(rawMdx).pipe(
    Effect.map((body) =>
      documentSections(
        source,
        title,
        Arr.join([`# ${title}`, "", body.trim()], "\n")
      )
    ),
    Effect.catchTag("MdxAgentProjectionError", (error) =>
      Effect.logWarning("A lesson could not be split into sections.").pipe(
        Effect.annotateLogs({
          appLocale: source.appLocale,
          contentKey: source.contentKey,
          reason: error.message,
        }),
        Effect.as([])
      )
    )
  );
});

/**
 * Makes the index hold the sections for one release: it embeds those whose
 * text the index does not hold yet, in bounded batches, and stores all of them
 * a bounded number at a time. Sections the index holds already are not sent to
 * the embedder again.
 */
const index = Effect.fn("contents.sections.index")(function* (
  releaseId: string,
  sections: readonly SectionFields[]
) {
  const { runMutation } = yield* MutationRunner;
  const { runQuery } = yield* QueryRunner;
  const gateway = yield* Gateway;
  const drafts = yield* Effect.forEach(sections, (section) =>
    sha256Hex(section.text).pipe(
      Effect.orDie,
      Effect.map((hash) => ({ ...section, hash }))
    )
  );
  const known = yield* runQuery(refs.internal.contents.sections.rows.stored, {
    model: embeddingModelId,
    sections: drafts,
  }).pipe(Effect.catchTag("SchemaError", Effect.die));
  const entries = Arr.zip(drafts, known);
  const pending = Arr.map(
    Arr.filter(entries, ([, isKnown]) => !isKnown),
    ([draft]) => draft
  );
  const vectors = Arr.flatten(
    yield* Effect.forEach(Arr.chunksOf(pending, EMBED_BATCH_SIZE), (batch) =>
      gateway.embed(Arr.map(batch, ({ text }) => embedInput(text)))
    )
  );
  const stored = Arr.appendAll(
    Arr.map(
      Arr.filter(entries, ([, isKnown]) => isKnown),
      ([draft]) => draft
    ),
    Arr.zipWith(pending, vectors, (draft, embedding) => ({
      ...draft,
      embedding,
    }))
  );
  const results = yield* Effect.forEach(
    Arr.chunksOf(stored, SECTIONS_PER_MUTATION),
    (chunk) =>
      runMutation(refs.internal.contents.sections.rows.save, {
        model: embeddingModelId,
        releaseId,
        sections: chunk,
      }).pipe(Effect.catchTag("SchemaError", Effect.die))
  );
  const total = (field: "kept" | "missing" | "written") =>
    Arr.reduce(results, 0, (sum, result) => sum + result[field]);
  return {
    embedded: pending.length,
    kept: total("kept"),
    missing: total("missing"),
    stale: Arr.some(results, ({ stale }) => stale),
    written: total("written"),
  };
});

/** What a step reports when the release changed under the build: it did nothing. */
const STALE = { ...NOTHING, next: null, stale: true };

/** Reads the next page of lessons and indexes its sections. */
const lessonsStep = Effect.fn("contents.sections.lessonsStep")(function* (
  cursor: string | null,
  releaseId: string | undefined
) {
  const { runQuery } = yield* QueryRunner;
  const page = yield* runQuery(refs.internal.contents.sections.rows.lessons, {
    cursor,
    ...(releaseId === undefined ? {} : { releaseId }),
  }).pipe(Effect.catchTag("SchemaError", Effect.die));
  if (page.kind === "stale") {
    return STALE;
  }
  const counts = yield* index(
    page.releaseId,
    Arr.flatten(yield* Effect.forEach(page.lessons, lessonSections))
  );
  return {
    ...counts,
    next: counts.stale
      ? null
      : {
          position:
            page.next === null
              ? ({ phase: "quran", surah: 1 } satisfies Position)
              : ({ cursor: page.next, phase: "lessons" } satisfies Position),
          releaseId: page.releaseId,
        },
  };
});

/** Reads one surah and indexes its passages. */
const quranStep = Effect.fn("contents.sections.quranStep")(function* (
  surah: number,
  releaseId: string | undefined
) {
  const { runQuery } = yield* QueryRunner;
  const page = yield* runQuery(refs.internal.contents.sections.rows.surah, {
    surah,
    ...(releaseId === undefined ? {} : { releaseId }),
  }).pipe(Effect.catchTag("SchemaError", Effect.die));
  if (page.kind === "stale") {
    return STALE;
  }
  if (page.kind === "none") {
    return {
      ...NOTHING,
      next: {
        position: { phase: "prune" } satisfies Position,
        releaseId: page.releaseId,
      },
      stale: false,
    };
  }
  const counts = yield* index(page.releaseId, page.sections);
  return {
    ...counts,
    next: counts.stale
      ? null
      : {
          position:
            surah < QURAN_SURAH_COUNT
              ? ({ phase: "quran", surah: surah + 1 } satisfies Position)
              : ({ phase: "prune" } satisfies Position),
          releaseId: page.releaseId,
        },
  };
});

/** Deletes a batch of rows that earlier releases left behind. */
const pruneStep = Effect.fn("contents.sections.pruneStep")(function* (
  releaseId: string | undefined
) {
  if (releaseId === undefined) {
    return STALE;
  }
  const { runMutation } = yield* MutationRunner;
  const pruned = yield* runMutation(
    refs.internal.contents.sections.rows.prune,
    { releaseId }
  ).pipe(Effect.catchTag("SchemaError", Effect.die));
  return {
    ...NOTHING,
    next: pruned.done
      ? null
      : { position: { phase: "prune" } satisfies Position, releaseId },
    stale: false,
  };
});

/**
 * Runs one step of the section build and schedules the next one, so that no
 * run holds a long job open. A step reads a bounded page of the active
 * release, embeds the sections the index lacks, and stores them; the steps
 * walk the lessons, then the Quran, then delete the rows that earlier releases
 * left behind. The position of a step is all a later run needs to resume, and
 * storing the same sections again changes nothing, so a build may be started
 * again at any time. Without a position the build starts at the first lesson,
 * and without a release it builds the active one.
 */
export const runStep = Effect.fn("contents.sections.run")(
  function* (input: typeof stepInputValidator.Type) {
    const position = input.position ?? START;
    const scheduler = yield* Scheduler;
    const outcome = yield* Match.value(position).pipe(
      Match.when({ phase: "lessons" }, ({ cursor }) =>
        lessonsStep(cursor, input.releaseId)
      ),
      Match.when({ phase: "quran" }, ({ surah }) =>
        quranStep(surah, input.releaseId)
      ),
      Match.when({ phase: "prune" }, () => pruneStep(input.releaseId)),
      Match.exhaustive
    );
    if (outcome.next !== null) {
      yield* scheduler.runAfter(
        Duration.millis(0),
        refs.internal.contents.sections.build.run,
        outcome.next
      );
    }
    yield* Effect.logInfo("Section build step done.").pipe(
      Effect.annotateLogs({
        embedded: outcome.embedded,
        missing: outcome.missing,
        phase: position.phase,
        stale: outcome.stale,
        written: outcome.written,
      })
    );
    return { ...outcome, position };
  },
  (step, input) =>
    Effect.tapError(step, (error) =>
      Effect.logError("Section build step failed.").pipe(
        Effect.annotateLogs({
          failure: error._tag,
          position: encodeJsonText(input.position ?? START),
        })
      )
    )
);
