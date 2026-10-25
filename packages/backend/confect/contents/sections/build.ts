import { QURAN_SURAH_COUNT } from "@nakafa/aksara-contracts/quran/spec";
import refs from "@repo/backend/confect/_generated/refs";
import {
  MutationRunner,
  QueryRunner,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import type {
  Position,
  stepInputValidator,
} from "@repo/backend/confect/contents/sections/build.spec";
import { lessonDocument } from "@repo/backend/confect/contents/sections/document";
import { syncDocuments } from "@repo/backend/confect/contents/sections/sync";
import { routingFacts } from "@repo/backend/confect/gateway/failure";
import { embeddingModelId } from "@repo/backend/confect/gateway/model";
import { encodeJsonText } from "@repo/utilities/json";
import { Duration, Effect, Match } from "effect";

const START = { cursor: null, missing: 0, phase: "lessons" } satisfies Position;
const NOTHING = {
  embedded: 0,
  kept: 0,
  missing: 0,
  removed: 0,
  skipped: 0,
  written: 0,
};

/** What a step reports when the release changed under the build: it did nothing. */
const STALE = { ...NOTHING, next: null, stale: true };

/** Reads the next page of lessons that the index lacks or holds at another version, and indexes its sections. */
const lessonsStep = Effect.fn("contents.sections.lessonsStep")(function* (
  cursor: string | null,
  releaseId: string | undefined,
  missing: number
) {
  const { runQuery } = yield* QueryRunner;
  const page = yield* runQuery(refs.internal.contents.sections.rows.lessons, {
    cursor,
    ...(releaseId === undefined ? {} : { releaseId }),
  }).pipe(Effect.catchTag("SchemaError", Effect.die));
  if (page.kind === "stale") {
    return STALE;
  }
  const counts = yield* syncDocuments(
    page.releaseId,
    yield* Effect.forEach(page.lessons, lessonDocument)
  );
  const left = missing + counts.missing;
  const position: Position =
    page.next === null
      ? { missing: left, phase: "quran", surah: 1 }
      : { cursor: page.next, missing: left, phase: "lessons" };
  return {
    ...counts,
    next: counts.stale ? null : { position, releaseId: page.releaseId },
    skipped: page.unchanged,
  };
});

/** Reads the next surah that the index lacks or holds at another version, and indexes its passages. */
const quranStep = Effect.fn("contents.sections.quranStep")(function* (
  surah: number,
  releaseId: string | undefined,
  missing: number
) {
  const { runQuery } = yield* QueryRunner;
  const page = yield* runQuery(refs.internal.contents.sections.rows.surah, {
    surah,
    ...(releaseId === undefined ? {} : { releaseId }),
  }).pipe(Effect.catchTag("SchemaError", Effect.die));
  if (page.kind === "stale") {
    return STALE;
  }
  if (page.kind === "done") {
    return {
      ...NOTHING,
      next: {
        position: { cursor: null, missing, phase: "prune" } satisfies Position,
        releaseId: page.releaseId,
      },
      skipped: page.unchanged,
      stale: false,
    };
  }
  const counts = yield* syncDocuments(page.releaseId, page.documents);
  const left = missing + counts.missing;
  const position: Position =
    page.surah < QURAN_SURAH_COUNT
      ? { missing: left, phase: "quran", surah: page.surah + 1 }
      : { cursor: null, missing: left, phase: "prune" };
  return {
    ...counts,
    next: counts.stale ? null : { position, releaseId: page.releaseId },
    skipped: page.unchanged,
  };
});

/**
 * Deletes the documents that the active release does not publish any more,
 * with their sections, each document whole and a bounded number of rows at a
 * time. When none are left to check, the step records the build as finished
 * with the number of sections it left out, which is when search starts to trust
 * the index.
 */
const pruneStep = Effect.fn("contents.sections.pruneStep")(function* (
  cursor: string | null,
  releaseId: string | undefined,
  missing: number
) {
  if (releaseId === undefined) {
    return STALE;
  }
  const { runMutation } = yield* MutationRunner;
  const pruned = yield* runMutation(
    refs.internal.contents.sections.rows.prune,
    { cursor, releaseId }
  ).pipe(Effect.catchTag("SchemaError", Effect.die));
  if (pruned.stale) {
    return STALE;
  }
  if (!pruned.done) {
    return {
      ...NOTHING,
      next: {
        position: {
          cursor: pruned.cursor,
          missing,
          phase: "prune",
        } satisfies Position,
        releaseId,
      },
      removed: pruned.deleted,
      stale: false,
    };
  }
  const finished = yield* runMutation(
    refs.internal.contents.sections.rows.finish,
    { missing, model: embeddingModelId, releaseId }
  ).pipe(Effect.catchTag("SchemaError", Effect.die));
  return {
    ...NOTHING,
    next: null,
    removed: pruned.deleted,
    stale: !finished.recorded,
  };
});

/**
 * Runs one step of the section build and schedules the next one, so that no
 * run holds a long job open. A step reads a bounded page of the active
 * release, passes over the documents whose sections the index holds at the
 * right version, embeds the sections the rest lacks, and stores them; the
 * steps walk the lessons, then the Quran, then delete the documents that the
 * release does not publish any more and record the build as finished, with the
 * sections it left out. A section that the model refuses is left out and
 * counted, and the build goes on to the next document. The position of a step
 * is all a later run needs to resume, and storing the same documents again
 * changes nothing, so a build may be started again at any time, and one that
 * finds nothing changed reads little and writes only its record. Without a
 * position the build starts at the first lesson, and without a release it builds
 * the active one.
 */
export const runStep = Effect.fn("contents.sections.run")(
  function* (input: typeof stepInputValidator.Type) {
    const position = input.position ?? START;
    const scheduler = yield* Scheduler;
    const outcome = yield* Match.value(position).pipe(
      Match.when({ phase: "lessons" }, ({ cursor, missing }) =>
        lessonsStep(cursor, input.releaseId, missing)
      ),
      Match.when({ phase: "quran" }, ({ missing, surah }) =>
        quranStep(surah, input.releaseId, missing)
      ),
      Match.when({ phase: "prune" }, ({ cursor, missing }) =>
        pruneStep(cursor, input.releaseId, missing)
      ),
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
        removed: outcome.removed,
        skipped: outcome.skipped,
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
          ...(error._tag === "DocumentEmbedFailure"
            ? {
                appLocale: error.appLocale,
                contentKey: error.contentKey,
                ...routingFacts(error.failure),
              }
            : {}),
        })
      )
    )
);
