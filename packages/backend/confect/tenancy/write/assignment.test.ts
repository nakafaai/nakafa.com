import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  checkHomeroom,
  clearRemovedHomeroom,
  insertHomeroom,
} from "@repo/backend/confect/tenancy/write/assignment";
import {
  grantRole,
  journal,
  slugOf,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Option } from "effect";

const nf = slugOf("nf");
const cohorts = refs.public.tenancy.cohorts;
const periods = refs.public.tenancy.periods;
const people = refs.public.tenancy.people;
const assignments = refs.public.tenancy.assignments;

type Fixture = Effect.Success<typeof tenancyFixture>;

/** The stored cohort, read as the system reads it. */
const readCohort = (
  fixture: Fixture,
  cohortId: GenericId.GenericId<"tenantCohorts">
) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader.table("tenantCohorts").get(cohortId)
    )
  );

/** The stored Person, read as the system reads it. */
const readPerson = (
  fixture: Fixture,
  personId: GenericId.GenericId<"tenantPeople">
) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader.table("tenantPeople").get(personId)
    )
  );

/** The journal entries of one change type, oldest first. */
const entriesOf = (fixture: Fixture, type: string) =>
  Effect.map(fixture.run(journal), (entries) =>
    Arr.filter(entries, (entry) => entry.change.type === type)
  );

/** A planned SMP period with one cohort, and a second active teacher of the unit. */
const setup = Effect.fn("test.write.assignment.setup")(function* (
  fixture: Fixture
) {
  const period = yield* fixture.as("admin").mutation(periods.create, {
    end: "2026-12-19",
    name: "Ganjil 2026/2027",
    slug: nf,
    start: "2026-07-13",
    unitId: fixture.units.smp,
  });
  const cohort = yield* fixture.as("admin").mutation(cohorts.create, {
    grade: 7,
    name: "7A",
    periodId: period.id,
    slug: nf,
  });
  const second = yield* fixture.as("admin").mutation(people.create, {
    name: "Guru Kedua",
    slug: nf,
  });
  yield* fixture.run(
    grantRole(fixture.tenants.nf, second.id, "teacher", {
      kind: "unit",
      unitId: fixture.units.smp,
    })
  );
  return { cohortId: cohort.id, second: second.id };
});

describe("tenancy/write assignment", () => {
  it.effect(
    "lets a removed teacher's row be replaced, and journals the removal and the new assignment",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { cohortId, second } = yield* setup(fixture);
        yield* fixture.as("admin").mutation(assignments.assign, {
          cohortId,
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        yield* fixture.as("admin").mutation(people.remove, {
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        const actor = {
          id: fixture.people.admin.personId,
          kind: "person" as const,
        };
        const cohort = yield* readCohort(fixture, cohortId);
        const replaced = yield* fixture.run(
          Effect.gen(function* () {
            const person = yield* (yield* DatabaseReader)
              .table("tenantPeople")
              .get(second)
              .pipe(Effect.orDie);
            const replacing = yield* checkHomeroom(cohort, person);
            yield* insertHomeroom(actor, cohort, second, replacing);
            return Option.isSome(replacing);
          })
        );
        expect(replaced).toBe(true);
        expect(
          Arr.map(yield* entriesOf(fixture, "assignment.removed"), (entry) => [
            entry.subject.id,
            entry.change.type,
          ])
        ).toEqual([[cohortId, "assignment.removed"]]);
        expect(
          Arr.map(
            yield* entriesOf(fixture, "assignment.created"),
            (entry) => entry.change
          )
        ).toMatchObject([
          { assignment: "homeroom", person: fixture.people.teacher.personId },
          { assignment: "homeroom", person: second },
        ]);
      })
  );

  it.effect(
    "refuses a cohort that an active teacher holds, and clears only a removed teacher's row",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const { cohortId, second } = yield* setup(fixture);
        yield* fixture.as("admin").mutation(assignments.assign, {
          cohortId,
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        const cohort = yield* readCohort(fixture, cohortId);
        const held = yield* fixture.run(
          checkHomeroom(cohort, yield* readPerson(fixture, second)).pipe(
            Effect.flip,
            Effect.map((error) => error._tag)
          )
        );
        expect(held).toBe("CohortHasHomeroom");
        yield* fixture.run(
          clearRemovedHomeroom(
            { id: fixture.people.admin.personId, kind: "person" },
            cohort
          )
        );
        expect(yield* entriesOf(fixture, "assignment.removed")).toHaveLength(0);
        yield* fixture.as("admin").mutation(people.remove, {
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        yield* fixture.run(
          clearRemovedHomeroom(
            { id: fixture.people.admin.personId, kind: "person" },
            cohort
          )
        );
        expect(
          Arr.map(
            yield* entriesOf(fixture, "assignment.removed"),
            (entry) => entry.change
          )
        ).toMatchObject([
          { assignment: "homeroom", person: fixture.people.teacher.personId },
        ]);
      })
  );
});
