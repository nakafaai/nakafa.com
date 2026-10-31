import type { GenericId } from "@confect/core";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { forumClass, openPeriod, period } from "@repo/backend/test/classroom";
import {
  keyedExam,
  scheduleSitting,
  seedAttempt,
  sittingRow,
} from "@repo/backend/test/sittings";
import { TENANCY_NOW, type tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

type Fixture = Effect.Success<typeof tenancyFixture>;

/** A class of an open period, with the student in it. */
export const openClass = Effect.fn("test.insight.class")(function* (
  fixture: Fixture
) {
  const term = yield* period(fixture, fixture.units.smp);
  yield* openPeriod(fixture, term.id);
  const forum = yield* forumClass(fixture, term.id, "X-1");
  return { ...forum, periodId: term.id };
});

/** A sitting of an exam of the school for one class's cohort, with the student's attempt and the exam's questions. */
export const sat = Effect.fn("test.insight.sat")(function* (
  fixture: Fixture,
  classId: GenericId.GenericId<"classes">
) {
  const examId = yield* keyedExam(fixture, "Ujian Fisika");
  const klass = yield* fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader.table("classes").get(classId).pipe(Effect.orDie)
    )
  );
  const made = yield* scheduleSitting(fixture, {
    closesAt: TENANCY_NOW + 2000,
    examId,
    group: { cohortId: klass.cohortId, kind: "cohort" },
    opensAt: TENANCY_NOW + 1000,
  });
  const sitting = yield* sittingRow(fixture, made.id);
  const attempt = yield* seedAttempt(fixture, {
    deadline: TENANCY_NOW + 2000,
    deviceId: null,
    person: fixture.people.student.personId,
    sittingId: made.id,
    state: "closing",
  });
  const exam = yield* fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader.table("exams").get(sitting.examId).pipe(Effect.orDie)
    )
  );
  return { attempt, examId, questions: exam.questions, sittingId: made.id };
});

/** Stores one scored answer of the student, as the scoring writes it. */
export const scored = (
  fixture: Fixture,
  made: {
    readonly attempt: GenericId.GenericId<"examAttempts">;
    readonly sittingId: GenericId.GenericId<"examSittings">;
  },
  question: GenericId.GenericId<"examQuestions">,
  points: number
) =>
  fixture.run(
    Effect.flatMap(DatabaseWriter, (writer) =>
      writer.table("examResults").insert({
        attempt: made.attempt,
        person: fixture.people.student.personId,
        points,
        question,
        response: [],
        sitting: made.sittingId,
        tenantId: fixture.tenants.nf,
        verdict: points > 0 ? "correct" : "incorrect",
      })
    ).pipe(Effect.asVoid, Effect.orDie)
  );
