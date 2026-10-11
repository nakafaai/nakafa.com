import { QURAN_SURAH_COUNT } from "@nakafa/aksara-contracts/quran/spec";
import refs from "@repo/backend/confect/_generated/refs";
import {
  MutationRunner,
  QueryRunner,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { documentSections } from "@repo/backend/confect/contents/sections/draft";
import type {
  lessonValidator,
  Position,
  stepInputValidator,
} from "@repo/backend/confect/contents/sections/schema";
import { syncSections } from "@repo/backend/confect/contents/sections/sync";
import { embeddingModelId } from "@repo/backend/confect/gateway/model";
import { projectMdxForAgentMarkdown } from "@repo/contents/llms/mdx";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Duration, Effect, Match } from "effect";

const START = { cursor: null, phase: "lessons" } satisfies Position;
const NOTHING = { embedded: 0, kept: 0, missing: 0, written: 0 };

/**
 * Splits one lesson into sections, from the same agent markdown that a reader
 * of the lesson gets, so that the anchor of a section opens it when it is read.
 * A lesson whose source cannot be projected fails the step, as it fails every
 * reader of that lesson, so that the build stops with the lesson named and the
 * index never lacks a lesson without saying so.
 */
const lessonSections = Effect.fn("contents.sections.lessonSections")(function* (
  lesson: typeof lessonValidator.Type
) {
  const { rawMdx, title, ...source } = lesson;
  const body = yield* projectMdxForAgentMarkdown(rawMdx).pipe(
    Effect.catchTag("MdxAgentProjectionError", (error) =>
      releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Lesson ${source.contentKey}/${source.appLocale} cannot be split into sections: ${error.message}`
      )
    )
  );
  return documentSections(
    source,
    title,
    Arr.join([`# ${title}`, "", body.trim()], "\n")
  );
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
  const counts = yield* syncSections(
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
  const counts = yield* syncSections(page.releaseId, page.sections);
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

/**
 * Deletes a batch of rows that earlier releases left behind. When none are
 * left, the index holds exactly the sections of the release, and the step
 * records that, which is when search starts to trust it.
 */
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
  if (!pruned.done) {
    return {
      ...NOTHING,
      next: { position: { phase: "prune" } satisfies Position, releaseId },
      stale: false,
    };
  }
  const finished = yield* runMutation(
    refs.internal.contents.sections.rows.finish,
    { model: embeddingModelId, releaseId }
  ).pipe(Effect.catchTag("SchemaError", Effect.die));
  return { ...NOTHING, next: null, stale: !finished.recorded };
});

/**
 * Runs one step of the section build and schedules the next one, so that no
 * run holds a long job open. A step reads a bounded page of the active
 * release, embeds the sections the index lacks, and stores them; the steps
 * walk the lessons, then the Quran, then delete the rows that earlier releases
 * left behind and record that the index is complete. The position of a step is
 * all a later run needs to resume, and storing the same sections again changes
 * nothing, so a build may be started again at any time. Without a position the
 * build starts at the first lesson, and without a release it builds the active
 * one.
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
