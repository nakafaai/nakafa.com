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
import { openClass, sat, scored } from "@repo/backend/test/insight";
import { keyedExam } from "@repo/backend/test/sittings";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { list, set } = refs.public.insight.tags;
const { mine, ofClass } = refs.public.insight.reads;
const narratives = refs.public.insight.narratives;
const { run } = refs.internal.insight.observe;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TENANCY_NOW);
});

describe("insight", () => {
  it.effect(
    "shows a student's own standing and keeps the class view from them",
    () =>
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
        const forum = yield* openClass(fixture);
        const made = yield* sat(fixture, forum.classId);
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
          after: null,
          sittingId: made.sittingId,
        });
        yield* scored(fixture, made, first, 0);
        yield* fixture.internal.mutation(run, {
          after: null,
          sittingId: made.sittingId,
        });
        const own = yield* fixture.as("student").query(mine, { slug: nf });
        expect(own).toMatchObject([
          { competency: "Gerak lurus", observations: 3 },
        ]);
        yield* tag(null);
        yield* scored(fixture, made, first, 1);
        yield* fixture.internal.mutation(run, {
          after: null,
          sittingId: made.sittingId,
        });
        expect(
          yield* fixture.as("student").query(mine, { slug: nf })
        ).toMatchObject([
          { competency: "Gerak lurus" },
          { competency: "Ujian Fisika" },
        ]);
        const seen = yield* teacher.query(ofClass, {
          classId: forum.classId,
          slug: nf,
        });
        expect(seen.forecasts).toBe(true);
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

  it.effect("names no competency for a question of another exam", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      const forum = yield* openClass(fixture);
      const made = yield* sat(fixture, forum.classId);
      const elsewhere = yield* keyedExam(fixture, "Ujian Lain");
      const exam = yield* fixture.run(
        Effect.flatMap(DatabaseReader, (reader) =>
          reader.table("exams").get(elsewhere).pipe(Effect.orDie)
        )
      );
      const teacher = fixture.as("teacher");
      yield* teacher.mutation(set, {
        competency: "Gerak",
        examId: made.examId,
        questionId: Arr.getUnsafe(exam.questions, 0),
        slug: nf,
      });
      expect(
        yield* teacher.query(list, { examId: made.examId, slug: nf })
      ).toSatisfy((tags: readonly { competency: string | null }[]) =>
        Arr.every(tags, (found) => found.competency === null)
      );
    })
  );

  it.effect(
    "shows a student only their newest period, once a new one starts",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        const forum = yield* openClass(fixture);
        const made = yield* sat(fixture, forum.classId);
        yield* scored(fixture, made, Arr.getUnsafe(made.questions, 0), 1);
        yield* fixture.internal.mutation(run, {
          after: null,
          sittingId: made.sittingId,
        });
        yield* fixture.run(
          Effect.gen(function* () {
            const reader = yield* DatabaseReader;
            const writer = yield* DatabaseWriter;
            const old = yield* reader
              .table("tenantPeriods")
              .get(forum.periodId);
            const { _creationTime, _id, ...fields } = old;
            const earlier = yield* writer
              .table("tenantPeriods")
              .insert({ ...fields, name: "Genap", status: "archived" });
            yield* writer.table("insightMastery").insert({
              competency: "Lama",
              earned: 1,
              observations: 1,
              periodId: earlier,
              personId: fixture.people.student.personId,
              possible: 1,
              rating: 1,
              tenantId: fixture.tenants.nf,
              updatedAt: TENANCY_NOW - 1000,
            });
          }).pipe(Effect.orDie)
        );
        expect(
          yield* fixture.as("student").query(mine, { slug: nf })
        ).toMatchObject([{ competency: "Ujian Fisika" }]);
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
        expect(
          yield* teacher
            .mutation(narratives.write, {
              ...names,
              personId: fixture.people.teacher.personId,
              text: "Bukan muridnya.",
            })
            .pipe(Effect.flip)
        ).toMatchObject({ _tag: "AccessDenied" });
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
