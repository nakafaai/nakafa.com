import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { classOf, cohort, nf, teach } from "@repo/backend/test/classroom";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

type Fixture = Effect.Success<typeof tenancyFixture>;

const { enter, own, release } = refs.public.records.grades;

/** A period of the SMP unit with its own name and dates, as the school's Admin adds it. */
const term = Effect.fn("test.records.own.term")(function* (
  fixture: Fixture,
  name: string,
  start: string,
  end: string
) {
  return yield* fixture
    .as("admin")
    .mutation(refs.public.tenancy.periods.create, {
      end,
      name,
      slug: nf,
      start,
      unitId: fixture.units.smp,
    });
});

/**
 * The classes of a new cohort of the period, one for each subject, which the school's teacher teaches, with the
 * school's student placed in the cohort.
 */
const gradeIn = Effect.fn("test.records.own.gradeIn")(function* (
  fixture: Fixture,
  periodId: GenericId.GenericId<"tenantPeriods">,
  cohortName: string,
  subjects: readonly string[]
) {
  const group = yield* cohort(fixture, periodId, cohortName);
  yield* fixture.as("admin").mutation(refs.public.tenancy.placements.place, {
    cohortId: group.id,
    personId: fixture.people.student.personId,
    slug: nf,
  });
  return yield* Effect.forEach(subjects, (subject) =>
    Effect.gen(function* () {
      const cls = yield* classOf(fixture, group.id, subject);
      yield* teach(fixture, cls.id, fixture.people.teacher.personId);
      return cls;
    })
  );
});

describe("records/grades own", () => {
  it.effect(
    "lists the student's released grades of every period, newest period first and each class by name, and never a draft",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const teacher = fixture.as("teacher");
        yield* fixture.as("admin").mutation(refs.public.records.schemes.store, {
          bands: [
            { label: "Cukup", minimum: 60 },
            { label: "Baik", minimum: 80 },
          ],
          effectiveFrom: 1,
          kktp: 75,
          slug: nf,
        });
        const older = yield* term(
          fixture,
          "Ganjil 2025/2026",
          "2025-07-14",
          "2025-12-20"
        );
        const newer = yield* term(
          fixture,
          "Genap 2025/2026",
          "2026-01-05",
          "2026-06-20"
        );
        const [sejarah] = yield* gradeIn(fixture, older.id, "IX-1", [
          "Sejarah",
        ]);
        const [kimia, biologi, fisika] = yield* gradeIn(
          fixture,
          newer.id,
          "X-1",
          ["Kimia", "Biologi", "Fisika"]
        );
        const enterGrade = (
          classId: GenericId.GenericId<"classes">,
          value: number
        ) =>
          teacher.mutation(enter, {
            classId,
            personId: fixture.people.student.personId,
            slug: nf,
            value,
          });
        const entered = yield* Effect.forEach(
          [
            [sejarah.id, 90],
            [kimia.id, 50],
            [biologi.id, 85],
          ] as const,
          ([classId, value]) => enterGrade(classId, value)
        );
        yield* enterGrade(fisika.id, 60);
        yield* Effect.forEach(entered, (grade) =>
          teacher.mutation(release, { gradeId: grade.id, slug: nf })
        );
        const grades = yield* fixture.as("student").query(own, { slug: nf });
        expect(grades).toEqual([
          {
            band: "Baik",
            className: "Biologi X-1",
            id: entered[2].id,
            kktp: "reached",
            period: "Genap 2025/2026",
            value: 85,
          },
          {
            className: "Kimia X-1",
            id: entered[1].id,
            kktp: "notReached",
            period: "Genap 2025/2026",
            value: 50,
          },
          {
            band: "Baik",
            className: "Sejarah IX-1",
            id: entered[0].id,
            kktp: "reached",
            period: "Ganjil 2025/2026",
            value: 90,
          },
        ]);
        expect(yield* fixture.as("teacher").query(own, { slug: nf })).toEqual(
          []
        );
      })
  );
});
