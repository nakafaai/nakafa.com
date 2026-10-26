import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  classOf,
  cohort,
  firstPage,
  nf,
  period,
  teach,
} from "@repo/backend/test/classroom";
import { grantRole, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

type Fixture = Effect.Success<typeof tenancyFixture>;

const { enter, scheme, sheet } = refs.public.records.grades;

/**
 * A class of the SMP unit with its subject teacher, the school's student placed in its
 * cohort, and a second student granted over the unit and placed there too.
 */
const setup = Effect.fn("test.records.sheet.setup")(function* (
  fixture: Fixture
) {
  const term = yield* period(fixture, fixture.units.smp);
  const x1 = yield* cohort(fixture, term.id, "X-1");
  const fisika = yield* classOf(fixture, x1.id, "Fisika");
  yield* teach(fixture, fisika.id, fixture.people.teacher.personId);
  yield* fixture.run(
    grantRole(fixture.tenants.nf, fixture.invited, "student", {
      kind: "unit",
      unitId: fixture.units.smp,
    })
  );
  for (const personId of [fixture.people.student.personId, fixture.invited]) {
    yield* fixture.as("admin").mutation(refs.public.tenancy.placements.place, {
      cohortId: x1.id,
      personId,
      slug: nf,
    });
  }
  return { classId: fisika.id };
});

describe("records/grades gradebook", () => {
  it.effect(
    "lists every placed student in the gradebook, a student without an entry with no grade",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { classId } = yield* setup(fixture);
        const other = fixture.invited;
        yield* fixture.as("teacher").mutation(enter, {
          classId,
          personId: fixture.people.student.personId,
          slug: nf,
          value: 70,
        });
        const lines = yield* fixture
          .as("teacher")
          .query(sheet, { ...firstPage, classId, slug: nf });
        expect(
          Arr.map(lines.page, (line) => [
            line.student.id,
            line.grade?.value ?? null,
          ])
        ).toEqual([
          [fixture.people.student.personId, 70],
          [other, null],
        ]);
      })
  );

  it.effect(
    "answers the scheme the next entry is judged by, the built-in one before any is stored",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { classId } = yield* setup(fixture);
        const read = fixture.as("teacher").query(scheme, { classId, slug: nf });
        expect(yield* read).toEqual({ bands: [], kktp: 75 });
        yield* fixture.as("admin").mutation(refs.public.records.schemes.store, {
          bands: [{ label: "Baik", minimum: 80 }],
          effectiveFrom: 1,
          kktp: 70,
          slug: nf,
        });
        expect(yield* read).toEqual({
          bands: [{ label: "Baik", minimum: 80 }],
          kktp: 70,
        });
      })
  );
});
