import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import type {
  ExamResultsDoc,
  ExamSittingsDoc,
} from "@repo/backend/confect/_generated/docs";
import { Id } from "@repo/backend/confect/_generated/id";
import insightInternal from "@repo/backend/confect/_generated/refs/insight.server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  DatabaseReader,
  DatabaseWriter,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { attemptResults } from "@repo/backend/confect/exams/results/rows";
import {
  reachedKktp,
  squaredError,
} from "@repo/backend/confect/insight/calibration";
import { chanceOf, ratingAfter } from "@repo/backend/confect/insight/mastery";
import spec from "@repo/backend/confect/insight/observe.spec";
import { Competency } from "@repo/backend/confect/insight/schema";
import { schemeForEntry } from "@repo/backend/confect/records/version";
import {
  Array as Arr,
  Clock,
  Duration,
  Effect,
  Layer,
  Number as Num,
  Option,
  Record,
  Schema,
  Struct,
} from "effect";

/** Scored answers one run reads: an exam of 50 questions and four students, and a page stays one transaction. */
const OBSERVE_BATCH = 200;

/** One scored answer, as a standing counts it. */
const Answer = Schema.Struct({
  competency: Competency,
  points: Schema.Finite,
  possible: Schema.Finite,
});

/** Where a run writes: the KKTP of the school, its time, its period, and its school. */
const Place = Schema.Struct({
  kktp: Schema.Finite,
  now: Schema.Finite,
  periodId: Id("tenantPeriods"),
  tenantId: Id("tenants"),
});

/** One forecast against what happened. */
const Test = Schema.Struct({ error: Schema.Finite, reached: Schema.Boolean });

/**
 * The period a sitting belongs to: its cohort's, or the active period of its unit. A unit with no active period has
 * no school year for the sitting to count in, so Insight leaves that sitting out.
 */
const periodOf = Effect.fn("insight.observe.period")(function* (
  sitting: ExamSittingsDoc
) {
  const reader = yield* DatabaseReader;
  if (sitting.cohortId !== null) {
    const cohort = yield* reader
      .table("tenantCohorts")
      .get(sitting.cohortId)
      .pipe(Effect.orDie);
    return Option.some(cohort.periodId);
  }
  const active = yield* reader
    .table("tenantPeriods")
    .index("by_unitId_and_status", (query) =>
      query.eq("unitId", sitting.unitId).eq("status", "active")
    )
    .first()
    .pipe(Effect.orDie);
  return Option.map(active, (period) => period._id);
});

/**
 * Reads one scored answer. The competency is the one its teacher named for the question, and a question with none
 * counts for its exam, so every released answer tells something from the first sitting on.
 */
const answerOf = Effect.fn("insight.observe.answer")(function* (
  result: ExamResultsDoc
) {
  const reader = yield* DatabaseReader;
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
  return { competency, points: result.points, possible: question.points };
});

/**
 * Adds what a student answered in one competency to their standing. A standing that was already there is a forecast
 * of this sitting, so it is tested against the result before the result joins it.
 */
const settle = Effect.fn("insight.observe.settle")(function* (
  place: typeof Place.Type,
  personId: ExamResultsDoc["person"],
  competency: string,
  answers: readonly (typeof Answer.Type)[]
) {
  const standing = yield* (yield* DatabaseReader)
    .table("insightMastery")
    .index("by_personId_and_periodId_and_competency", (query) =>
      query
        .eq("personId", personId)
        .eq("periodId", place.periodId)
        .eq("competency", competency)
    )
    .first()
    .pipe(Effect.orDie);
  const earned = Num.sumAll(Arr.map(answers, (answer) => answer.points));
  const possible = Num.sumAll(Arr.map(answers, (answer) => answer.possible));
  const progress = Arr.reduce(
    answers,
    Option.match(standing, {
      onNone: () => ({ observations: 0, rating: 0 }),
      onSome: Struct.pick(["observations", "rating"]),
    }),
    (state, answer) => ({
      observations: state.observations + 1,
      rating: ratingAfter(
        state.rating,
        state.observations,
        answer.points / answer.possible
      ),
    })
  );
  const writer = yield* DatabaseWriter;
  yield* Option.match(standing, {
    onNone: () =>
      writer.table("insightMastery").insert({
        ...progress,
        competency,
        earned,
        periodId: place.periodId,
        personId,
        possible,
        tenantId: place.tenantId,
        updatedAt: place.now,
      }),
    onSome: (row) =>
      writer.table("insightMastery").patch(row._id, {
        ...progress,
        earned: row.earned + earned,
        possible: row.possible + possible,
        updatedAt: place.now,
      }),
  }).pipe(Effect.orDie);
  const reached = reachedKktp(earned, possible, place.kktp);
  return Option.map(standing, (row) => ({
    error: squaredError(
      chanceOf(row.earned, row.possible, place.kktp),
      reached
    ),
    reached,
  }));
});

/** Counts one student's sitting into their standing, and answers the forecasts it tested. */
const observeStudent = Effect.fn("insight.observe.student")(function* (
  place: typeof Place.Type,
  sittingId: GenericId.GenericId<"examSittings">,
  personId: ExamResultsDoc["person"]
) {
  const results = yield* attemptResults(sittingId, personId);
  const answers = yield* Effect.forEach(results, answerOf);
  const tests = yield* Effect.forEach(
    Record.toEntries(Arr.groupBy(answers, (answer) => answer.competency)),
    ([competency, group]) => settle(place, personId, competency, group)
  );
  return Arr.getSomes(tests);
});

/** Adds a run's tests to the sitting's score. Runs of a sitting follow one another, so no two write it at once. */
const recordTests = Effect.fn("insight.observe.record")(function* (
  sitting: ExamSittingsDoc,
  tests: readonly (typeof Test.Type)[],
  at: number
) {
  const count = tests.length;
  if (count === 0) {
    return;
  }
  const errors = Num.sumAll(Arr.map(tests, (test) => test.error));
  const reached = Arr.filter(tests, (test) => test.reached).length;
  const found = yield* (yield* DatabaseReader)
    .table("insightScores")
    .index("by_sittingId", (query) => query.eq("sittingId", sitting._id))
    .first()
    .pipe(Effect.orDie);
  const writer = yield* DatabaseWriter;
  yield* Option.match(found, {
    onNone: () =>
      writer.table("insightScores").insert({
        at,
        count,
        errors,
        reached,
        sittingId: sitting._id,
        tenantId: sitting.tenantId,
      }),
    onSome: (score) =>
      writer.table("insightScores").patch(score._id, {
        count: score.count + count,
        errors: score.errors + errors,
        reached: score.reached + reached,
      }),
  }).pipe(Effect.orDie);
});

/**
 * Observes the students of one page of a sitting's scored answers, each whole, because a forecast is tested against
 * a student's whole sitting. The next run starts after the last of them.
 */
const run = FunctionImpl.make(
  databaseSchema,
  spec,
  "run",
  Effect.fn("insight.observe.run")(function* ({ after, sittingId }) {
    const reader = yield* DatabaseReader;
    const sitting = yield* reader
      .table("examSittings")
      .get(sittingId)
      .pipe(Effect.orDie);
    const periodId = yield* periodOf(sitting);
    if (Option.isNone(periodId)) {
      return null;
    }
    const page = yield* reader
      .table("examResults")
      .index("by_sittingId_and_personId_and_questionId", (query) =>
        after === null
          ? query.eq("sitting", sittingId)
          : query.eq("sitting", sittingId).gt("person", after)
      )
      .take(OBSERVE_BATCH)
      .pipe(Effect.orDie);
    const students = Arr.dedupe(Arr.map(page, (result) => result.person));
    const now = yield* Clock.currentTimeMillis;
    const { kktp } = yield* schemeForEntry(sitting.tenantId);
    const place = {
      kktp,
      now,
      periodId: periodId.value,
      tenantId: sitting.tenantId,
    };
    const tests = yield* Effect.forEach(students, (personId) =>
      observeStudent(place, sittingId, personId)
    );
    yield* recordTests(sitting, Arr.flatten(tests), now);
    const last = Arr.last(students);
    if (page.length < OBSERVE_BATCH || Option.isNone(last)) {
      return null;
    }
    yield* (yield* Scheduler).runAfter(
      Duration.zero,
      insightInternal.observe.run,
      { after: last.value, sittingId }
    );
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(run),
  GroupImpl.finalize
);
