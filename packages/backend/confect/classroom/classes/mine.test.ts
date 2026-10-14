import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import {
  classOf,
  cohort,
  denied,
  nf,
  period,
  teach,
} from "@repo/backend/test/classroom";
import { grantRole, slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const { archive, mine } = refs.public.classroom.classes;
const periods = refs.public.tenancy.periods;
const placements = refs.public.tenancy.placements;

describe("classroom/classes mine", () => {
  it.effect(
    "lists a student's own active classes of the period, and nothing to a leader with no class",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const x2 = yield* cohort(fixture, term.id, "X-2");
        yield* fixture.as("admin").mutation(placements.place, {
          cohortId: x1.id,
          personId: fixture.people.student.personId,
          slug: nf,
        });
        const own = yield* classOf(fixture, x1.id, "Fisika");
        yield* classOf(fixture, x2.id, "Fisika");
        const kimia = yield* classOf(fixture, x1.id, "Kimia");
        yield* fixture
          .as("admin")
          .mutation(archive, { classId: kimia.id, slug: nf });
        const studentView = yield* fixture
          .as("student")
          .query(mine, { periodId: term.id, slug: nf });
        const adminView = yield* fixture
          .as("admin")
          .query(mine, { periodId: term.id, slug: nf });
        expect(Arr.map(studentView, (row) => row.id)).toEqual([own.id]);
        expect(adminView).toEqual([]);
      })
  );

  it.effect(
    "refuses a period of another school to mine, and a period that no longer exists",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const foreign = yield* fixture
          .as("otherOwner")
          .mutation(periods.create, {
            end: "2026-12-19",
            name: "Ganjil",
            slug: slugOf("other"),
            start: "2026-07-13",
            unitId: fixture.units.sd,
          });
        const term = yield* period(fixture, fixture.units.smp);
        yield* fixture.run(
          Effect.gen(function* () {
            const writer = yield* DatabaseWriter;
            yield* writer.table("tenantPeriods").delete(term.id);
          })
        );
        const otherSchool = yield* fixture
          .as("student")
          .query(mine, { periodId: foreign.id, slug: nf })
          .pipe(Effect.flip);
        const missing = yield* fixture
          .as("student")
          .query(mine, { periodId: term.id, slug: nf })
          .pipe(Effect.flip);
        expect([otherSchool, missing]).toMatchObject([
          denied("resource"),
          denied("resource"),
        ]);
      })
  );

  it.effect(
    "lists the active classes a teacher teaches in a period, by name",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const fisika = yield* classOf(fixture, x1.id, "Fisika");
        const kimia = yield* classOf(fixture, x1.id, "Kimia");
        yield* teach(fixture, fisika.id, fixture.people.teacher.personId);
        yield* teach(fixture, kimia.id, fixture.people.teacher.personId);
        yield* fixture
          .as("admin")
          .mutation(archive, { classId: kimia.id, slug: nf });
        const taught = yield* fixture
          .as("teacher")
          .query(mine, { periodId: term.id, slug: nf });
        expect(Arr.map(taught, (row) => row.name)).toEqual(["Fisika X-1"]);
      })
  );

  it.effect(
    "lists a class once when its teacher is also placed in its cohort",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* period(fixture, fixture.units.smp);
        const x1 = yield* cohort(fixture, term.id, "X-1");
        const fisika = yield* classOf(fixture, x1.id, "Fisika");
        yield* fixture.run(
          grantRole(
            fixture.tenants.nf,
            fixture.people.teacher.personId,
            "student",
            { kind: "unit", unitId: fixture.units.smp }
          )
        );
        yield* fixture.as("admin").mutation(placements.place, {
          cohortId: x1.id,
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        yield* teach(fixture, fisika.id, fixture.people.teacher.personId);
        const listed = yield* fixture
          .as("teacher")
          .query(mine, { periodId: term.id, slug: nf });
        expect(Arr.map(listed, (row) => row.id)).toEqual([fisika.id]);
      })
  );
});
