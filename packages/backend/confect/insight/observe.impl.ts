import { FunctionImpl, GroupImpl } from "@confect/server";
import type { ExamResultsDoc } from "@repo/backend/confect/_generated/docs";
import insightInternal from "@repo/backend/confect/_generated/refs/insight.server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { ratingAfter } from "@repo/backend/confect/insight/mastery";
import spec from "@repo/backend/confect/insight/observe.spec";
import { Clock, Duration, Effect, Layer, Option } from "effect";

/** Scored answers one run reads: an exam of 50 questions and two students, and a page stays one transaction. */
const OBSERVE_BATCH = 200;

/**
 * Adds one scored answer to its student's standing. The competency is the one its teacher named for the question, and
 * a question with none counts for its exam, so every released answer tells something from the first sitting on.
 */
const observe = Effect.fn("insight.observe.one")(function* (
  result: ExamResultsDoc,
  now: number
) {
  const reader = yield* DatabaseReader;
  const writer = yield* DatabaseWriter;
  const tag = yield* reader
    .table("insightTags")
    .index("by_questionId", (query) => query.eq("questionId", result.question))
    .first()
    .pipe(Effect.orDie);
  const question = yield* reader
    .table("examQuestions")
    .get(result.question)
    .pipe(Effect.orDie);
  const competency = yield* Option.match(tag, {
    onNone: () =>
      reader
        .table("exams")
        .get(question.examId)
        .pipe(
          Effect.map((exam) => exam.title),
          Effect.orDie
        ),
    onSome: (found) => Effect.succeed(found.competency),
  });
  const standing = yield* reader
    .table("insightMastery")
    .index("by_personId_and_competency", (query) =>
      query.eq("personId", result.person).eq("competency", competency)
    )
    .first()
    .pipe(Effect.orDie);
  const share = result.points / question.points;
  yield* Option.match(standing, {
    onNone: () =>
      writer.table("insightMastery").insert({
        competency,
        earned: result.points,
        observations: 1,
        personId: result.person,
        possible: question.points,
        rating: ratingAfter(0, 0, share),
        tenantId: result.tenantId,
        updatedAt: now,
      }),
    onSome: (row) =>
      writer.table("insightMastery").patch(row._id, {
        earned: row.earned + result.points,
        observations: row.observations + 1,
        possible: row.possible + question.points,
        rating: ratingAfter(row.rating, row.observations, share),
        updatedAt: now,
      }),
  }).pipe(Effect.orDie);
});

/** Observes one page of a sitting's scored answers, and the next run reads the next page. */
const run = FunctionImpl.make(
  databaseSchema,
  spec,
  "run",
  Effect.fn("insight.observe.run")(function* ({ cursor, sittingId }) {
    const page = yield* (yield* DatabaseReader)
      .table("examResults")
      .index("by_sittingId_and_personId_and_questionId", (query) =>
        query.eq("sitting", sittingId)
      )
      .paginate({ cursor, numItems: OBSERVE_BATCH })
      .pipe(Effect.orDie);
    const now = yield* Clock.currentTimeMillis;
    yield* Effect.forEach(page.page, (result) => observe(result, now), {
      discard: true,
    });
    if (!page.isDone) {
      yield* (yield* Scheduler).runAfter(
        Duration.zero,
        insightInternal.observe.run,
        { cursor: page.continueCursor, sittingId }
      );
    }
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(run),
  GroupImpl.finalize
);
