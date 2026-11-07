import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { writeClass } from "@repo/backend/test/classroom";
import {
  foreignCohort,
  journal,
  slugOf,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema } from "effect";

const nf = slugOf("nf");
const { archive, create, list, remove } = refs.public.tenancy.cohorts;
const assignments = refs.public.tenancy.assignments;
const periods = refs.public.tenancy.periods;
const placements = refs.public.tenancy.placements;
const denied = (reason: "resource" | "role" | "condition") => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});
const missingCohort = Schema.decodeUnknownSync(Id("tenantCohorts"))(
  "000000000000000099999tenantCohorts"
);

type Fixture = Effect.Success<typeof tenancyFixture>;

/** Creates the SMP period of the fixture as its Admin, planned, and returns it. */
const smp = (fixture: Fixture) =>
  fixture.as("admin").mutation(periods.create, {
    end: "2026-12-19",
    name: "Ganjil 2026/2027",
    slug: nf,
    start: "2026-07-13",
    unitId: fixture.units.smp,
  });

/** Creates one cohort of grade 7 in a period as the school's Admin. */
const add = (
  fixture: Fixture,
  periodId: GenericId.GenericId<"tenantPeriods">,
  name: string
) =>
  fixture.as("admin").mutation(create, { grade: 7, name, periodId, slug: nf });

/** The names of the cohorts of one period, as its list reads them. */
const namesOf = (
  fixture: Fixture,
  periodId: GenericId.GenericId<"tenantPeriods">
) =>
  Effect.map(
    fixture.as("admin").query(list, { periodId, slug: nf }),
    (cohorts) => Arr.map(cohorts, (cohort) => cohort.name)
  );

describe("tenancy/cohorts remove", () => {
  it.effect(
    "deletes an active and an archived cohort that hold nothing, and journals each deletion",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* smp(fixture);
        const first = yield* add(fixture, term.id, "7A");
        const second = yield* add(fixture, term.id, "7B");
        yield* add(fixture, term.id, "7C");
        yield* fixture
          .as("admin")
          .mutation(archive, { cohortId: second.id, slug: nf });
        yield* fixture
          .as("admin")
          .mutation(remove, { cohortId: first.id, slug: nf });
        yield* fixture
          .as("admin")
          .mutation(remove, { cohortId: second.id, slug: nf });
        expect(yield* namesOf(fixture, term.id)).toEqual(["7C"]);
        const entries = yield* fixture.run(journal);
        expect(
          Arr.filter(entries, (entry) => entry.change.type === "cohort.removed")
        ).toMatchObject([
          { subject: { id: first.id } },
          { subject: { id: second.id } },
        ]);
      })
  );

  it.effect(
    "refuses a cohort that holds a student or an active homeroom teacher, names what holds it, and keeps it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* smp(fixture);
        const placed = yield* add(fixture, term.id, "7A");
        const homed = yield* add(fixture, term.id, "7B");
        yield* fixture.as("admin").mutation(placements.place, {
          cohortId: placed.id,
          personId: fixture.people.student.personId,
          slug: nf,
        });
        yield* fixture.as("admin").mutation(assignments.assign, {
          cohortId: homed.id,
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        const refusals = yield* Effect.forEach([placed, homed], (cohort) =>
          fixture
            .as("admin")
            .mutation(remove, { cohortId: cohort.id, slug: nf })
            .pipe(Effect.flip)
        );
        expect(refusals).toMatchObject([
          { _tag: "CohortInUse", code: "COHORT_IN_USE", holds: "members" },
          { _tag: "CohortInUse", code: "COHORT_IN_USE", holds: "homeroom" },
        ]);
        expect(yield* namesOf(fixture, term.id)).toEqual(["7A", "7B"]);
      })
  );

  it.effect(
    "refuses a cohort that a class points at, even once the class is archived",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const classId = yield* writeClass(
          fixture,
          fixture.units.sma,
          "fisika-x-1",
          "active",
          "archived"
        );
        const held = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("classes").get(classId)
          )
        );
        const refused = yield* fixture
          .as("admin")
          .mutation(remove, { cohortId: held.cohortId, slug: nf })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ holds: "classes" });
      })
  );

  it.effect(
    "refuses a cohort of another school, and one that does not exist, as a resource",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const foreign = yield* foreignCohort(fixture);
        const refusals = yield* Effect.forEach(
          [foreign.id, missingCohort],
          (cohortId) =>
            fixture
              .as("admin")
              .mutation(remove, { cohortId, slug: nf })
              .pipe(Effect.flip)
        );
        expect(refusals).toMatchObject([
          denied("resource"),
          denied("resource"),
        ]);
      })
  );

  it.effect("refuses a teacher, who may not manage the school", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const term = yield* smp(fixture);
      const kept = yield* add(fixture, term.id, "7A");
      const refused = yield* fixture
        .as("teacher")
        .mutation(remove, { cohortId: kept.id, slug: nf })
        .pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "AccessDenied" });
      expect(yield* namesOf(fixture, term.id)).toEqual(["7A"]);
    })
  );
});
