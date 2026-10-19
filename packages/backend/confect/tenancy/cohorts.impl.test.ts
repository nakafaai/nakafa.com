import type { GenericId } from "@confect/core";
import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseWriter } from "@repo/backend/confect/_generated/services";
import { COHORT_LIMIT } from "@repo/backend/confect/tenancy/cohort";
import {
  foreignCohort,
  journal,
  slugOf,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const nf = slugOf("nf");
const { activePeriod, create, get, list, rename, archive, restore } =
  refs.public.tenancy.cohorts;
const assignments = refs.public.tenancy.assignments;
const periods = refs.public.tenancy.periods;
const denied = (reason: "resource" | "role" | "condition") => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});

type Fixture = Effect.Success<typeof tenancyFixture>;

/** Creates the SMA period of the fixture as its Admin, planned, and returns the period the mutation made. */
const sma = (fixture: Fixture) =>
  fixture.as("admin").mutation(periods.create, {
    end: "2026-12-19",
    name: "Ganjil 2026/2027",
    slug: nf,
    start: "2026-07-13",
    unitId: fixture.units.sma,
  });

/** Creates one cohort of a period as the school's Admin. */
const cohort = (
  fixture: Fixture,
  periodId: GenericId.GenericId<"tenantPeriods">,
  name: string,
  grade: number
) => fixture.as("admin").mutation(create, { grade, name, periodId, slug: nf });

describe("tenancy/cohorts create and list", () => {
  it.effect("creates an active cohort in a period, and records it", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const period = yield* sma(fixture);
      const made = yield* cohort(fixture, period.id, "7A", 7);
      expect(made).toEqual({
        grade: 7,
        id: expect.any(String),
        name: "7A",
        status: "active",
      });
      expect(yield* fixture.run(journal)).toMatchObject([
        { change: { type: "period.created" } },
        {
          actor: { id: fixture.people.admin.personId, kind: "person" },
          change: { type: "cohort.created" },
          owner: { kind: "tenant", tenantId: fixture.tenants.nf },
          subject: { id: made.id, kind: "cohort" },
        },
      ]);
    })
  );

  it.effect(
    "lists a period's cohorts by grade, then by name without case",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* sma(fixture);
        yield* cohort(fixture, period.id, "B", 7);
        yield* cohort(fixture, period.id, "a", 7);
        yield* cohort(fixture, period.id, "8A", 8);
        const listed = yield* fixture
          .as("principal")
          .query(list, { periodId: period.id, slug: nf });
        expect(Arr.map(listed, (row) => row.name)).toEqual(["a", "B", "8A"]);
      })
  );

  it.effect(
    "refuses a name another cohort of the period has, without regard to case",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* sma(fixture);
        yield* cohort(fixture, period.id, "7A", 7);
        const taken = yield* cohort(fixture, period.id, "7a", 7).pipe(
          Effect.flip
        );
        expect(taken).toMatchObject({ _tag: "CohortNameTaken" });
      })
  );

  it.effect("refuses a period that already holds the most cohorts it can", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const period = yield* sma(fixture);
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          Effect.forEach(
            Arr.makeBy(COHORT_LIMIT, (index) => index),
            (index) =>
              writer.table("tenantCohorts").insert({
                grade: 1,
                name: `Kelas ${index}`,
                nameKey: `kelas ${index}`,
                periodId: period.id,
                status: "active",
                tenantId: fixture.tenants.nf,
                unitId: fixture.units.sma,
              }),
            { discard: true }
          )
        )
      );
      const refusal = yield* cohort(fixture, period.id, "Penuh", 1).pipe(
        Effect.flip
      );
      expect(refusal).toMatchObject({ _tag: "CohortLimit" });
      const listed = yield* fixture
        .as("admin")
        .query(list, { periodId: period.id, slug: nf });
      expect(listed).toHaveLength(COHORT_LIMIT);
    })
  );

  it.effect(
    "refuses a cohort in an archived period, for every role alike",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* sma(fixture);
        yield* fixture.as("admin").mutation(periods.open, {
          periodId: period.id,
          slug: nf,
        });
        yield* fixture.as("admin").mutation(periods.archive, {
          periodId: period.id,
          slug: nf,
        });
        const archivedPeriod = yield* cohort(fixture, period.id, "7A", 7).pipe(
          Effect.flip
        );
        const byPrincipal = yield* fixture
          .as("principal")
          .mutation(create, {
            grade: 7,
            name: "7B",
            periodId: period.id,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect([archivedPeriod, byPrincipal]).toMatchObject([
          denied("condition"),
          denied("condition"),
        ]);
      })
  );
});

describe("tenancy/cohorts active period", () => {
  it.effect(
    "answers the active period of a unit, and none once it is archived",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* sma(fixture);
        const query = { slug: nf, unitId: fixture.units.sma };
        const principal = fixture.as("principal");
        expect(yield* principal.query(activePeriod, query)).toBeNull();
        yield* fixture
          .as("admin")
          .mutation(periods.open, { periodId: period.id, slug: nf });
        expect(yield* principal.query(activePeriod, query)).toBe(period.id);
        yield* fixture
          .as("admin")
          .mutation(periods.archive, { periodId: period.id, slug: nf });
        expect(yield* principal.query(activePeriod, query)).toBeNull();
      })
  );

  it.effect(
    "refuses the active period of a unit to a student, and of a unit of another school",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const byStudent = yield* fixture
          .as("student")
          .query(activePeriod, { slug: nf, unitId: fixture.units.sma })
          .pipe(Effect.flip);
        const foreign = yield* fixture
          .as("admin")
          .query(activePeriod, { slug: nf, unitId: fixture.units.sd })
          .pipe(Effect.flip);
        expect([byStudent, foreign]).toMatchObject([
          denied("role"),
          denied("resource"),
        ]);
      })
  );
});

describe("tenancy/cohorts get", () => {
  it.effect(
    "reads a cohort with its period, and its homeroom teacher once one is assigned",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const term = yield* fixture.as("admin").mutation(periods.create, {
          end: "2026-12-19",
          name: "Ganjil 2026/2027",
          slug: nf,
          start: "2026-07-13",
          unitId: fixture.units.smp,
        });
        const made = yield* cohort(fixture, term.id, "7A", 7);
        const read = fixture
          .as("admin")
          .query(get, { cohortId: made.id, slug: nf });
        expect(yield* read).toMatchObject({
          homeroom: null,
          periodId: term.id,
        });
        yield* fixture.as("admin").mutation(assignments.assign, {
          cohortId: made.id,
          personId: fixture.people.teacher.personId,
          slug: nf,
        });
        expect(yield* read).toMatchObject({
          homeroom: { id: fixture.people.teacher.personId },
        });
      })
  );

  it.effect(
    "refuses a cohort's detail to a student, to a counselor, and to a cohort of another school",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* sma(fixture);
        const made = yield* cohort(fixture, period.id, "7A", 7);
        const foreign = yield* foreignCohort(fixture);
        const byStudent = yield* fixture
          .as("student")
          .query(get, { cohortId: made.id, slug: nf })
          .pipe(Effect.flip);
        const byCounselor = yield* fixture
          .as("counselor")
          .query(get, { cohortId: made.id, slug: nf })
          .pipe(Effect.flip);
        const byAdmin = yield* fixture
          .as("admin")
          .query(get, { cohortId: foreign.id, slug: nf })
          .pipe(Effect.flip);
        expect([byStudent, byCounselor, byAdmin]).toMatchObject([
          denied("role"),
          denied("role"),
          denied("resource"),
        ]);
      })
  );
});

describe("tenancy/cohorts roles", () => {
  it.effect(
    "lets a plan role read a period's cohorts, and refuses it any change",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* sma(fixture);
        const made = yield* cohort(fixture, period.id, "7A", 7);
        const read = yield* fixture
          .as("principal")
          .query(list, { periodId: period.id, slug: nf });
        const refused = yield* fixture
          .as("principal")
          .mutation(rename, { cohortId: made.id, name: "7B", slug: nf })
          .pipe(Effect.flip);
        const byStudent = yield* fixture
          .as("student")
          .query(list, { periodId: period.id, slug: nf })
          .pipe(Effect.flip);
        expect(Arr.map(read, (row) => row.id)).toEqual([made.id]);
        expect([refused, byStudent]).toMatchObject([
          denied("role"),
          denied("role"),
        ]);
      })
  );
});

describe("tenancy/cohorts rename, archive, and restore", () => {
  it.effect(
    "renames a cohort, and keeps a case-only change to its own name",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* sma(fixture);
        const seventh = yield* cohort(fixture, period.id, "7A", 7);
        yield* cohort(fixture, period.id, "7B", 7);
        const caseOnly = yield* fixture
          .as("admin")
          .mutation(rename, { cohortId: seventh.id, name: "7a", slug: nf });
        const same = yield* fixture
          .as("admin")
          .mutation(rename, { cohortId: seventh.id, name: "7a", slug: nf });
        const taken = yield* fixture
          .as("admin")
          .mutation(rename, { cohortId: seventh.id, name: "7b", slug: nf })
          .pipe(Effect.flip);
        expect([caseOnly.name, same.name]).toEqual(["7a", "7a"]);
        expect(taken).toMatchObject({ _tag: "CohortNameTaken" });
        expect(yield* fixture.run(journal)).toMatchObject([
          { change: { type: "period.created" } },
          { change: { type: "cohort.created" } },
          { change: { type: "cohort.created" } },
          { change: { type: "cohort.renamed" }, subject: { id: seventh.id } },
        ]);
      })
  );

  it.effect(
    "archives a cohort, which then refuses writes and stays readable",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* sma(fixture);
        const made = yield* cohort(fixture, period.id, "7A", 7);
        const archived = yield* fixture
          .as("admin")
          .mutation(archive, { cohortId: made.id, slug: nf });
        const refused = yield* fixture
          .as("admin")
          .mutation(rename, { cohortId: made.id, name: "7B", slug: nf })
          .pipe(Effect.flip);
        const listed = yield* fixture
          .as("principal")
          .query(list, { periodId: period.id, slug: nf });
        expect(archived.status).toBe("archived");
        expect(refused).toMatchObject(denied("condition"));
        expect(Arr.map(listed, (row) => row.status)).toEqual(["archived"]);
        expect(yield* fixture.run(journal)).toMatchObject([
          { change: { type: "period.created" } },
          { change: { type: "cohort.created" } },
          { change: { type: "cohort.archived" }, subject: { id: made.id } },
        ]);
      })
  );
});

describe("tenancy/cohorts archived school", () => {
  it.effect("refuses a rename of a cohort in an archived school", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const cohortId = yield* fixture.run(
        Effect.gen(function* () {
          const writer = yield* DatabaseWriter;
          const periodId = yield* writer.table("tenantPeriods").insert({
            end: "2026-12-19",
            name: "Smk",
            start: "2026-07-13",
            status: "active",
            tenantId: fixture.tenants.nf,
            unitId: fixture.units.smk,
          });
          return yield* writer.table("tenantCohorts").insert({
            grade: 10,
            name: "10A",
            nameKey: "10a",
            periodId,
            status: "active",
            tenantId: fixture.tenants.nf,
            unitId: fixture.units.smk,
          });
        })
      );
      const refused = yield* fixture
        .as("admin")
        .mutation(rename, { cohortId, name: "10B", slug: nf })
        .pipe(Effect.flip);
      expect(refused).toMatchObject(denied("condition"));
    })
  );
});

describe("tenancy/cohorts cross-tenant", () => {
  it.effect("refuses a period of another school", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const foreign = yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer.table("tenantPeriods").insert({
            end: "2026-12-19",
            name: "Asing",
            start: "2026-07-13",
            status: "planned",
            tenantId: fixture.tenants.other,
            unitId: fixture.units.sd,
          })
        )
      );
      const refusal = yield* fixture
        .as("admin")
        .mutation(create, { grade: 1, name: "1A", periodId: foreign, slug: nf })
        .pipe(Effect.flip);
      expect(refusal).toMatchObject(denied("resource"));
    })
  );
});

describe("tenancy/cohorts of an archived period", () => {
  it.effect(
    "refuses to rename or archive a cohort once its period is archived",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* sma(fixture);
        const made = yield* cohort(fixture, period.id, "7A", 7);
        yield* fixture.as("admin").mutation(periods.open, {
          periodId: period.id,
          slug: nf,
        });
        yield* fixture.as("admin").mutation(periods.archive, {
          periodId: period.id,
          slug: nf,
        });
        const renamed = yield* fixture
          .as("admin")
          .mutation(rename, { cohortId: made.id, name: "7B", slug: nf })
          .pipe(Effect.flip);
        const archived = yield* fixture
          .as("admin")
          .mutation(archive, { cohortId: made.id, slug: nf })
          .pipe(Effect.flip);
        expect([renamed, archived]).toMatchObject([
          denied("condition"),
          denied("condition"),
        ]);
      })
  );
});

describe("tenancy/cohorts owner, unit admin, and non-member", () => {
  it.effect(
    "lets the Owner form a cohort, and refuses a unit's Admin and a non-member",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const period = yield* sma(fixture);
        const owned = yield* fixture.as("owner").mutation(create, {
          grade: 8,
          name: "8A",
          periodId: period.id,
          slug: nf,
        });
        const unitAdmin = yield* fixture
          .as("unitAdmin")
          .mutation(create, {
            grade: 8,
            name: "8B",
            periodId: period.id,
            slug: nf,
          })
          .pipe(Effect.flip);
        const stranger = yield* fixture
          .as("stranger")
          .mutation(create, {
            grade: 8,
            name: "8C",
            periodId: period.id,
            slug: nf,
          })
          .pipe(Effect.flip);
        expect(owned).toMatchObject({ grade: 8, name: "8A", status: "active" });
        expect([unitAdmin, stranger]).toMatchObject([
          denied("role"),
          { _tag: "NotMember", code: "NOT_MEMBER" },
        ]);
      })
  );
});
