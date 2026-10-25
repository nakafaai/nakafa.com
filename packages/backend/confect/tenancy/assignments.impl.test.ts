import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  grantRole,
  journal,
  slugOf,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const nf = slugOf("nf");
const { assign, unassign } = refs.public.tenancy.assignments;
const cohorts = refs.public.tenancy.cohorts;
const periods = refs.public.tenancy.periods;
const people = refs.public.tenancy.people;
const denied = (reason: "resource" | "role" | "condition") => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});

type Fixture = Effect.Success<typeof tenancyFixture>;

/** Creates the SMP period of the fixture as its Admin, planned, and returns it. */
const smpPeriod = (fixture: Fixture) =>
  fixture.as("admin").mutation(periods.create, {
    end: "2026-12-19",
    name: "Ganjil 2026/2027",
    slug: nf,
    start: "2026-07-13",
    unitId: fixture.units.smp,
  });

/** Creates one cohort of a period as the school's Admin. */
const cohort = (
  fixture: Fixture,
  periodId: GenericId.GenericId<"tenantPeriods">,
  name: string
) =>
  fixture
    .as("admin")
    .mutation(cohorts.create, { grade: 7, name, periodId, slug: nf });

describe("tenancy/assignments assign", () => {
  it.effect(
    "makes an active teacher of the unit the homeroom teacher, and journals it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* smpPeriod(fixture);
        const made = yield* cohort(fixture, period.id, "7A");
        const assigned = yield* fixture.as("admin").mutation(assign, {
          cohortId: made.id,
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        expect(assigned).toEqual({
          cohortId: made.id,
          id: expect.any(String),
          kind: "homeroom",
          personId: fixture.people.teacher.personId,
        });
        expect(yield* fixture.run(journal)).toMatchObject([
          { change: { type: "period.created" } },
          { change: { type: "cohort.created" } },
          {
            actor: { id: fixture.people.admin.personId, kind: "person" },
            change: {
              assignment: "homeroom",
              person: fixture.people.teacher.personId,
              type: "assignment.created",
            },
            owner: { kind: "tenant", tenantId: fixture.tenants.nf },
            subject: { id: made.id, kind: "cohort" },
          },
        ]);
      })
  );

  it.effect("refuses a second homeroom teacher for one cohort", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const period = yield* smpPeriod(fixture);
      const made = yield* cohort(fixture, period.id, "7A");
      const second = yield* fixture
        .as("admin")
        .mutation(people.create, { name: "Guru Kedua", slug: nf });
      yield* fixture.run(
        grantRole(fixture.tenants.nf, second.id, "teacher", {
          kind: "unit",
          unitId: fixture.units.smp,
        })
      );
      yield* fixture.as("admin").mutation(assign, {
        cohortId: made.id,
        personId: fixture.people.teacher.personId,
        slug: nf,
      });
      const refusal = yield* fixture
        .as("admin")
        .mutation(assign, { cohortId: made.id, personId: second.id, slug: nf })
        .pipe(Effect.flip);
      expect(refusal).toMatchObject({ _tag: "CohortHasHomeroom" });
    })
  );

  it.effect(
    "replaces the homeroom teacher of a cohort who was removed, and journals the removal and the new assignment",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* smpPeriod(fixture);
        const made = yield* cohort(fixture, period.id, "7A");
        const second = yield* fixture
          .as("admin")
          .mutation(people.create, { name: "Guru Kedua", slug: nf });
        yield* fixture.run(
          grantRole(fixture.tenants.nf, second.id, "teacher", {
            kind: "unit",
            unitId: fixture.units.smp,
          })
        );
        yield* fixture.as("admin").mutation(assign, {
          cohortId: made.id,
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        yield* fixture.as("admin").mutation(people.remove, {
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        const replaced = yield* fixture.as("admin").mutation(assign, {
          cohortId: made.id,
          personId: second.id,
          slug: nf,
        });
        expect(replaced).toMatchObject({
          kind: "homeroom",
          personId: second.id,
        });
        const entries = yield* fixture.run(journal);
        const ofType = (type: string) =>
          Arr.filter(entries, (entry) => entry.change.type === type);
        expect(ofType("assignment.removed")).toHaveLength(1);
        expect(ofType("assignment.created")).toHaveLength(2);
      })
  );

  it.effect(
    "reads a cohort with no homeroom teacher once its teacher is removed, and keeps the cohort readable",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* smpPeriod(fixture);
        const made = yield* cohort(fixture, period.id, "7A");
        yield* fixture.as("admin").mutation(assign, {
          cohortId: made.id,
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        yield* fixture.as("admin").mutation(people.remove, {
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        const read = yield* fixture
          .as("admin")
          .query(cohorts.get, { cohortId: made.id, slug: nf });
        expect(read).toMatchObject({ homeroom: null, id: made.id });
      })
  );

  it.effect(
    "refuses a teacher who already leads another cohort of the period",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* smpPeriod(fixture);
        const first = yield* cohort(fixture, period.id, "7A");
        const second = yield* cohort(fixture, period.id, "7B");
        yield* fixture.as("admin").mutation(assign, {
          cohortId: first.id,
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        const refusal = yield* fixture
          .as("admin")
          .mutation(assign, {
            cohortId: second.id,
            personId: fixture.people.teacher.personId,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(refusal).toMatchObject({ _tag: "TeacherHasHomeroom" });
      })
  );

  it.effect(
    "refuses a cohort that holds an active homeroom teacher before a teacher who leads another cohort of the period",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* smpPeriod(fixture);
        const first = yield* cohort(fixture, period.id, "7A");
        const second = yield* cohort(fixture, period.id, "7B");
        const holder = yield* fixture
          .as("admin")
          .mutation(people.create, { name: "Guru Kedua", slug: nf });
        yield* fixture.run(
          grantRole(fixture.tenants.nf, holder.id, "teacher", {
            kind: "unit",
            unitId: fixture.units.smp,
          })
        );
        yield* fixture.as("admin").mutation(assign, {
          cohortId: first.id,
          personId: holder.id,
          slug: nf,
        });
        yield* fixture.as("admin").mutation(assign, {
          cohortId: second.id,
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        const refusal = yield* fixture
          .as("admin")
          .mutation(assign, {
            cohortId: first.id,
            personId: fixture.people.teacher.personId,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(refusal).toMatchObject({ _tag: "CohortHasHomeroom" });
      })
  );

  it.effect("refuses a person who is not an active teacher of the unit", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const period = yield* smpPeriod(fixture);
      const made = yield* cohort(fixture, period.id, "7A");
      const student = yield* fixture
        .as("admin")
        .mutation(assign, {
          cohortId: made.id,
          personId: fixture.people.student.personId,
          slug: nf,
        })
        .pipe(Effect.flip);
      const suspended = yield* fixture
        .as("admin")
        .mutation(assign, {
          cohortId: made.id,
          personId: fixture.people.suspended.personId,
          slug: nf,
        })
        .pipe(Effect.flip);
      expect([student, suspended]).toMatchObject([
        { _tag: "PersonNotTeacher" },
        { _tag: "PersonNotTeacher" },
      ]);
    })
  );

  it.effect("refuses a person of another tenant", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const period = yield* smpPeriod(fixture);
      const made = yield* cohort(fixture, period.id, "7A");
      const foreign = yield* fixture
        .as("admin")
        .mutation(assign, {
          cohortId: made.id,
          personId: fixture.people.otherOwner.personId,
          slug: nf,
        })
        .pipe(Effect.flip);
      expect(foreign).toMatchObject(denied("resource"));
    })
  );

  it.effect("lets only an Admin of the school assign a homeroom teacher", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const period = yield* smpPeriod(fixture);
      const made = yield* cohort(fixture, period.id, "7A");
      const refused = yield* fixture
        .as("principal")
        .mutation(assign, {
          cohortId: made.id,
          personId: fixture.people.teacher.personId,
          slug: nf,
        })
        .pipe(Effect.flip);
      expect(refused).toMatchObject(denied("role"));
    })
  );
});

describe("tenancy/assignments unassign", () => {
  it.effect(
    "removes the homeroom teacher, journals it, and answers null when none is set",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* smpPeriod(fixture);
        const made = yield* cohort(fixture, period.id, "7A");
        const none = yield* fixture
          .as("admin")
          .mutation(unassign, { cohortId: made.id, slug: nf });
        const assigned = yield* fixture.as("admin").mutation(assign, {
          cohortId: made.id,
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        const removed = yield* fixture
          .as("admin")
          .mutation(unassign, { cohortId: made.id, slug: nf });
        const again = yield* fixture
          .as("admin")
          .mutation(unassign, { cohortId: made.id, slug: nf });
        expect([none, again]).toEqual([null, null]);
        expect(removed).toEqual(assigned);
        expect(
          Arr.filter(
            yield* fixture.run(journal),
            (entry) => entry.change.type === "assignment.removed"
          )
        ).toMatchObject([
          {
            actor: { id: fixture.people.admin.personId, kind: "person" },
            change: {
              assignment: "homeroom",
              person: fixture.people.teacher.personId,
              type: "assignment.removed",
            },
            subject: { id: made.id, kind: "cohort" },
          },
        ]);
      })
  );

  it.effect(
    "answers null for a removed teacher's row and keeps that row until an assignment replaces it",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* smpPeriod(fixture);
        const made = yield* cohort(fixture, period.id, "7A");
        yield* fixture.as("admin").mutation(assign, {
          cohortId: made.id,
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        yield* fixture.as("admin").mutation(people.remove, {
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        const answer = yield* fixture
          .as("admin")
          .mutation(unassign, { cohortId: made.id, slug: nf });
        const rows = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader
              .table("tenantAssignments")
              .index("by_cohortId_and_kind", (query) =>
                query.eq("cohortId", made.id).eq("kind", "homeroom")
              )
              .take(5)
          )
        );
        expect(answer).toBeNull();
        expect(rows).toMatchObject([
          { personId: fixture.people.teacher.personId },
        ]);
      })
  );
});

describe("tenancy/assignments relation", () => {
  it.effect(
    "opens the cohort and its members to its homeroom teacher, and to nobody else",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* smpPeriod(fixture);
        const made = yield* cohort(fixture, period.id, "7A");
        const page = { paginationOpts: { cursor: null, numItems: 10 } };
        const before = yield* fixture
          .as("teacher")
          .query(cohorts.members, { cohortId: made.id, slug: nf, ...page })
          .pipe(Effect.flip);
        yield* fixture.as("admin").mutation(assign, {
          cohortId: made.id,
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        const opened = yield* fixture
          .as("teacher")
          .query(cohorts.members, { cohortId: made.id, slug: nf, ...page });
        const byStudent = yield* fixture
          .as("student")
          .query(cohorts.members, { cohortId: made.id, slug: nf, ...page })
          .pipe(Effect.flip);
        expect([before, byStudent]).toMatchObject([
          denied("role"),
          denied("role"),
        ]);
        expect(opened.page).toEqual([]);
      })
  );

  it.effect(
    "closes the cohort to its former homeroom teacher once removed",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* smpPeriod(fixture);
        const made = yield* cohort(fixture, period.id, "7A");
        const page = { paginationOpts: { cursor: null, numItems: 10 } };
        yield* fixture.as("admin").mutation(assign, {
          cohortId: made.id,
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        yield* fixture
          .as("admin")
          .mutation(unassign, { cohortId: made.id, slug: nf });
        const after = yield* fixture
          .as("teacher")
          .query(cohorts.members, { cohortId: made.id, slug: nf, ...page })
          .pipe(Effect.flip);
        expect(after).toMatchObject(denied("role"));
      })
  );

  it.effect(
    "reads no cohort once its homeroom teacher is removed, because a removed Person is not a member",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* smpPeriod(fixture);
        const made = yield* cohort(fixture, period.id, "7A");
        const page = { paginationOpts: { cursor: null, numItems: 10 } };
        yield* fixture.as("admin").mutation(assign, {
          cohortId: made.id,
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        yield* fixture.as("admin").mutation(people.remove, {
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        const after = yield* fixture
          .as("teacher")
          .query(cohorts.members, { cohortId: made.id, slug: nf, ...page })
          .pipe(Effect.flip);
        expect(after).toMatchObject({ _tag: "NotMember" });
      })
  );
});
