import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { nf } from "@repo/backend/test/editor";
import { teacherExam } from "@repo/backend/test/exams";
import {
  attemptRow,
  CLOSES_AT,
  deviceOf,
  enterOk,
  keyedExam,
  keyedSchool,
  OPENS_AT,
  openedSitting,
  type SittingFixture,
  scheduleSitting,
  sittingRow,
} from "@repo/backend/test/sittings";
import {
  journal,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const results = refs.public.exams.results.results;
const timers = refs.internal.exams.sittings.timers;

/** The device that the test student enters the sitting with. */
const DEVICE = deviceOf(1);

/** The first question of a sitting's exam, which the tests answer. */
const firstQuestion = Effect.fn("test.results.question")(function* (
  fixture: SittingFixture,
  sittingId: GenericId.GenericId<"examSittings">
) {
  const sitting = yield* sittingRow(fixture, sittingId);
  const exam = yield* fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader.table("exams").get(sitting.examId).pipe(Effect.orDie)
    )
  );
  return yield* Effect.fromOption(Arr.head(exam.questions));
});

/** Every scored row of the test database, which the tests read as the scoring wrote them. */
const scoredRows = (fixture: SittingFixture) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader
        .table("examResults")
        .index("by_creation_time")
        .take(100)
        .pipe(Effect.orDie)
    )
  );

/** The student answers the question with one option, and the attempt is the student's. */
const answer = (
  fixture: SittingFixture,
  sittingId: GenericId.GenericId<"examSittings">,
  questionId: GenericId.GenericId<"examQuestions">,
  optionId: string
) =>
  fixture.as("student").mutation(refs.public.exams.sittings.answer, {
    deviceId: DEVICE,
    questionId,
    response: [optionId],
    sittingId,
    slug: nf,
    version: 1,
  });

/** The student's Finish, which submits the attempt. */
const finish = (
  fixture: SittingFixture,
  sittingId: GenericId.GenericId<"examSittings">
) =>
  fixture.as("student").mutation(refs.public.exams.sittings.finish, {
    deviceId: DEVICE,
    sittingId,
    slug: nf,
  });

/** The teacher closes the sitting and the server closes its open attempts at once. */
const closeNow = Effect.fn("test.results.close")(function* (
  fixture: SittingFixture,
  sittingId: GenericId.GenericId<"examSittings">
) {
  yield* fixture.as("teacher").mutation(refs.public.exams.sittings.close, {
    sittingId,
    slug: nf,
  });
  yield* fixture.internal.mutation(timers.closeDue, {
    atDeadline: "now",
    sittingId,
  });
});

describe("exams/results", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
  });

  it.effect(
    "scores a submitted attempt once, so a second Finish writes no second row",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterOk(fixture, {
          deviceId: DEVICE,
          sittingId: made.id,
          token: made.token,
        });
        const questionId = yield* firstQuestion(fixture, made.id);
        yield* answer(fixture, made.id, questionId, "option-1");
        yield* finish(fixture, made.id);
        yield* finish(fixture, made.id);
        const rows = yield* scoredRows(fixture);
        expect(rows).toMatchObject([
          {
            attempt: entered.attempt,
            points: 1,
            question: questionId,
            response: ["option-1"],
            verdict: "correct",
          },
        ]);
      })
  );

  it.effect(
    "scores an unanswered question incorrect when the sitting closes, and submits each attempt once",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const entered = yield* enterOk(fixture, {
          deviceId: DEVICE,
          sittingId: made.id,
          token: made.token,
        });
        yield* closeNow(fixture, made.id);
        expect(yield* attemptRow(fixture, entered.attempt)).toMatchObject({
          state: "closing",
        });
        yield* fixture.internal.mutation(timers.submit, {
          attemptId: entered.attempt,
        });
        yield* fixture.internal.mutation(timers.submit, {
          attemptId: entered.attempt,
        });
        expect(yield* scoredRows(fixture)).toMatchObject([
          { points: 0, response: [], verdict: "incorrect" },
        ]);
      })
  );

  it.effect(
    "refuses the results to another school, to a student, and to a deputy's release",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const overview = (account: "otherOwner" | "student") =>
          fixture.as(account).query(results.overview, {
            sittingId: made.id,
            slug: nf,
          });
        expect(yield* overview("otherOwner").pipe(Effect.flip)).toMatchObject({
          _tag: "NotMember",
        });
        expect(yield* overview("student").pipe(Effect.flip)).toMatchObject({
          _tag: "AccessDenied",
        });
        expect(
          yield* fixture
            .as("deputy")
            .mutation(results.release, { sittingId: made.id, slug: nf })
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "AccessDenied" });
      })
  );

  it.effect(
    "shows a teacher the overview, the students and a question, and refuses a release before the close",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const questionId = yield* firstQuestion(fixture, made.id);
        const teacher = fixture.as("teacher");
        const overview = yield* teacher.query(results.overview, {
          sittingId: made.id,
          slug: nf,
        });
        expect(overview.releasedAt).toBeNull();
        expect(overview.can).toEqual(
          expect.arrayContaining(["result.release", "result.view"])
        );
        expect(overview.questions).toEqual([
          {
            id: questionId,
            number: 1,
            optionIds: ["option-1", "option-2", "option-3", "option-4"],
            points: 1,
            sourceIds: [],
            targetIds: [],
          },
        ]);
        expect(
          yield* teacher
            .mutation(results.release, { sittingId: made.id, slug: nf })
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "SittingNotClosed" });
        yield* enterOk(fixture, {
          deviceId: DEVICE,
          sittingId: made.id,
          token: made.token,
        });
        yield* answer(fixture, made.id, questionId, "option-1");
        yield* finish(fixture, made.id);
        const students = yield* teacher.query(results.byStudent, {
          paginationOpts: { cursor: null, numItems: 10 },
          sittingId: made.id,
          slug: nf,
        });
        expect(students.page).toMatchObject([
          { answered: 1, pending: 0, points: 1, state: "submitted" },
        ]);
        const answers = yield* teacher.query(results.byQuestion, {
          paginationOpts: { cursor: null, numItems: 10 },
          questionId,
          sittingId: made.id,
          slug: nf,
        });
        expect(answers.page).toMatchObject([
          { response: ["option-1"], verdict: "correct" },
        ]);
        const stats = yield* teacher.query(results.questionStats, {
          questionId,
          sittingId: made.id,
          slug: nf,
        });
        expect(stats).toEqual({
          answered: 1,
          complete: true,
          correct: 1,
          counted: 1,
          incorrect: 0,
          optionCounts: [
            { count: 1, optionId: "option-1" },
            { count: 0, optionId: "option-2" },
            { count: 0, optionId: "option-3" },
            { count: 0, optionId: "option-4" },
          ],
          partial: 0,
          pending: 0,
        });
      })
  );

  it.effect(
    "refuses the statistics of a question that another exam holds",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const other = yield* teacherExam(fixture, "Other");
        const [otherQuestion] = other.questions;
        expect(
          yield* fixture
            .as("teacher")
            .query(results.questionStats, {
              questionId: otherQuestion.id,
              sittingId: made.id,
              slug: nf,
            })
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "QuestionNotInExam" });
      })
  );

  it.effect(
    "releases the results once, journals the release, and shows a student only its own released result",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const questionId = yield* firstQuestion(fixture, made.id);
        yield* enterOk(fixture, {
          deviceId: DEVICE,
          sittingId: made.id,
          token: made.token,
        });
        yield* answer(fixture, made.id, questionId, "option-2");
        yield* finish(fixture, made.id);
        const mine = () =>
          fixture.as("student").query(results.mine, {
            sittingId: made.id,
            slug: nf,
          });
        expect(yield* mine()).toBeNull();
        yield* closeNow(fixture, made.id);
        yield* fixture
          .as("unitAdmin")
          .mutation(results.release, { sittingId: made.id, slug: nf });
        yield* fixture
          .as("unitAdmin")
          .mutation(results.release, { sittingId: made.id, slug: nf });
        const released = yield* fixture.run(journal);
        expect(
          Arr.filter(
            released,
            (entry) => entry.change.type === "exam.results.released"
          )
        ).toHaveLength(1);
        expect(yield* mine()).toEqual({
          points: 0,
          questions: [
            {
              earned: 0,
              id: questionId,
              number: 1,
              optionIds: ["option-1", "option-2", "option-3", "option-4"],
              points: 1,
              response: ["option-2"],
              sourceIds: [],
              targetIds: [],
              verdict: "incorrect",
            },
          ],
        });
        expect(
          yield* fixture
            .as("teacher")
            .query(results.mine, { sittingId: made.id, slug: nf })
        ).toBeNull();
        expect(yield* sittingRow(fixture, made.id)).toMatchObject({
          resultsReleasedAt: expect.any(Number),
        });
      })
  );

  it.effect(
    "lists a student who has not finished with no score, and shows that student no result",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        yield* enterOk(fixture, {
          deviceId: DEVICE,
          sittingId: made.id,
          token: made.token,
        });
        const students = yield* fixture.as("teacher").query(results.byStudent, {
          paginationOpts: { cursor: null, numItems: 10 },
          sittingId: made.id,
          slug: nf,
        });
        expect(students.page).toMatchObject([
          {
            answered: null,
            points: null,
            pending: null,
            state: "inProgress",
            submittedAt: null,
          },
        ]);
        expect(
          yield* fixture
            .as("student")
            .query(results.mine, { sittingId: made.id, slug: nf })
        ).toBeNull();
      })
  );

  it.effect(
    "filters the students by state, and reads only the attempts in that state",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        yield* enterOk(fixture, {
          deviceId: DEVICE,
          sittingId: made.id,
          token: made.token,
        });
        const studentsIn = (state: "inProgress" | "submitted") =>
          fixture.as("teacher").query(results.byStudent, {
            paginationOpts: { cursor: null, numItems: 10 },
            sittingId: made.id,
            slug: nf,
            state,
          });
        expect((yield* studentsIn("inProgress")).page).toMatchObject([
          { state: "inProgress" },
        ]);
        expect((yield* studentsIn("submitted")).page).toEqual([]);
      })
  );

  it.effect(
    "lets the school's Admin read the results and see the release, which the Admin may make",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const made = yield* openedSitting(fixture, "PTS");
        const overview = yield* fixture
          .as("unitAdmin")
          .query(results.overview, { sittingId: made.id, slug: nf });
        expect(overview.can).toEqual(
          expect.arrayContaining(["result.release", "result.view"])
        );
      })
  );

  it.effect(
    "shows the release only to the exam's author and the Admin, and refuses it to a teacher who did not write the exam, who still grades",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* keyedSchool(fixture);
        const examId = yield* keyedExam(fixture, "Admin's", "admin");
        const made = yield* scheduleSitting(fixture, {
          actor: "admin",
          closesAt: CLOSES_AT,
          examId,
          group: { kind: "unit", unitId: fixture.units.smp },
          opensAt: OPENS_AT,
        });
        const teacher = fixture.as("teacher");
        const overview = yield* teacher.query(results.overview, {
          sittingId: made.id,
          slug: nf,
        });
        expect(overview.can).toEqual(["result.view", "result.grade"]);
        expect(
          yield* teacher
            .mutation(results.release, { sittingId: made.id, slug: nf })
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "AccessDenied" });
      })
  );
});
