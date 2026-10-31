import type { GenericId } from "@confect/core";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import {
  forumClass,
  keyedFixture,
  nf,
  period,
} from "@repo/backend/test/classroom";
import {
  keyedExam,
  scheduleSitting,
  seedAttempt,
  seedPlacement,
  sittingRow,
} from "@repo/backend/test/sittings";
import { TENANCY_NOW, type tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

type Fixture = Effect.Success<typeof tenancyFixture>;

const { list, set } = refs.public.insight.tags;
const { mine, ofClass } = refs.public.insight.reads;
const narratives = refs.public.insight.narratives;
const { run } = refs.internal.insight.observe;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TENANCY_NOW);
});

/** A sitting of an exam of the school, with the student's attempt and the questions of its exam. */
const sat = Effect.fn("test.insight.sat")(function* (fixture: Fixture) {
  const examId = yield* keyedExam(fixture, "Ujian Fisika");
  const cohortId = yield* seedPlacement(
    fixture,
    fixture.people.student.personId
  );
  const made = yield* scheduleSitting(fixture, {
    closesAt: TENANCY_NOW + 2000,
    examId,
    group: { cohortId, kind: "cohort" },
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
const scored = (
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

describe("insight", () => {
  it.effect("shows a student's own standing and keeps the class view from them", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      const term = yield* period(fixture, fixture.units.smp);
      const forum = yield* forumClass(fixture, term.id, "X-1");
      expect(yield* fixture.as("student").query(mine, { slug: nf })).toEqual(
        []
      );
      expect(
        yield* fixture
          .as("student")
          .query(ofClass, { classId: forum.classId, slug: nf })
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "AccessDenied" });
    })
  );

  it.effect(
    "counts a released answer for its named competency, and for its exam when it names none",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-1");
        const made = yield* sat(fixture);
        const first = Arr.getUnsafe(made.questions, 0);
        const teacher = fixture.as("teacher");
        const tag = (competency: string | null) =>
          teacher.mutation(set, {
            competency,
            examId: made.examId,
            questionId: first,
            slug: nf,
          });
        yield* tag("Gerak");
        yield* tag("Gerak lurus");
        expect(
          yield* teacher.query(list, { examId: made.examId, slug: nf })
        ).toEqual(
          Arr.map(made.questions, (id, index) => ({
            competency: index === 0 ? "Gerak lurus" : null,
            id,
            number: index + 1,
          }))
        );
        yield* scored(fixture, made, first, 1);
        yield* fixture.internal.mutation(run, {
          cursor: null,
          sittingId: made.sittingId,
        });
        yield* scored(fixture, made, first, 0);
        yield* fixture.internal.mutation(run, {
          cursor: null,
          sittingId: made.sittingId,
        });
        const own = yield* fixture.as("student").query(mine, { slug: nf });
        expect(own).toMatchObject([
          { competency: "Gerak lurus", observations: 3 },
        ]);
        yield* tag(null);
        yield* scored(fixture, made, first, 1);
        yield* fixture.internal.mutation(run, {
          cursor: null,
          sittingId: made.sittingId,
        });
        expect(yield* fixture.as("student").query(mine, { slug: nf })).toMatchObject(
          [{ competency: "Gerak lurus" }, { competency: "Ujian Fisika" }]
        );
        const seen = yield* teacher.query(ofClass, {
          classId: forum.classId,
          slug: nf,
        });
        expect(seen.kktp).toBe(75);
        expect(seen.students[0]?.skills[0]?.chance).toBeGreaterThan(0);

        yield* tag(null);
        yield* tag(null);
        expect(
          yield* teacher.query(list, { examId: made.examId, slug: nf })
        ).toSatisfy((tags: readonly { competency: string | null }[]) =>
          Arr.every(tags, (found) => found.competency === null)
        );
      })
  );

  it.effect(
    "lets a teacher write a narrative, share it with a guardian, and take it back",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const forum = yield* forumClass(fixture, term.id, "X-1");
        const names = {
          classId: forum.classId,
          personId: fixture.people.student.personId,
          slug: nf,
        };
        const teacher = fixture.as("teacher");
        expect(
          yield* teacher.mutation(narratives.share, names).pipe(Effect.flip)
        ).toMatchObject({ _tag: "NarrativeMissing" });
        expect(
          yield* teacher.mutation(narratives.withdraw, names).pipe(Effect.flip)
        ).toMatchObject({ _tag: "NarrativeMissing" });
        yield* teacher.mutation(narratives.write, { ...names, text: "Rajin." });
        yield* teacher.mutation(narratives.write, {
          ...names,
          text: "Rajin sekali.",
        });
        yield* teacher.mutation(narratives.share, names);
        const shared = yield* teacher.query(ofClass, {
          classId: forum.classId,
          slug: nf,
        });
        expect(shared.students[0]?.narrative).toEqual({
          shared: true,
          text: "Rajin sekali.",
        });
        yield* teacher.mutation(narratives.withdraw, names);
        const back = yield* teacher.query(ofClass, {
          classId: forum.classId,
          slug: nf,
        });
        expect(back.students[0]?.narrative?.shared).toBe(false);
      })
  );
});
