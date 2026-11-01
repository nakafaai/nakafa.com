import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  claimedMembers,
  grantRole,
  journal,
  slugOf,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect } from "effect";

const nf = slugOf("nf");
const { create, list, students, teachers } = refs.public.tenancy.people;
const { create: createCohort } = refs.public.tenancy.cohorts;
const periods = refs.public.tenancy.periods;
const denied = (reason: "resource" | "role" | "condition") => ({
  _tag: "AccessDenied",
  code: "ACCESS_DENIED",
  reason,
});
const firstPage = { paginationOpts: { cursor: null, numItems: 10 } };

describe("tenancy/people search", () => {
  it.effect("finds people by name, of the status and account it asks for", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const admin = fixture.as("admin");
      const named = (args: { account?: "unclaimed"; search: string }) =>
        admin.query(list, {
          ...firstPage,
          slug: nf,
          status: "active",
          ...args,
        });
      expect((yield* named({ search: "Teach" })).page).toMatchObject([
        { id: fixture.people.teacher.personId },
      ]);
      expect(
        (yield* named({ account: "unclaimed", search: "Teach" })).page
      ).toEqual([]);
      expect((yield* named({ search: "Suspended" })).page).toEqual([]);
    })
  );

  it.effect(
    "finds a student or a teacher by name, and leaves out whoever lacks the role",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const admin = fixture.as("admin");
        const found = (search: string) =>
          admin.query(students, { ...firstPage, search, slug: nf });
        expect((yield* found("Student")).page).toMatchObject([
          { id: fixture.people.student.personId },
        ]);
        expect((yield* found("Teacher")).page).toEqual([]);
        expect((yield* found("Suspended")).page).toEqual([]);
      })
  );
});

describe("tenancy/people list and create", () => {
  it.effect(
    "lists the people of one status, with whether each holds an account",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const active = yield* fixture.as("admin").query(list, {
          paginationOpts: { cursor: null, numItems: 20 },
          slug: nf,
          status: "active",
        });
        const [owner] = Arr.filter(
          active.page,
          (person) => person.id === fixture.people.owner.personId
        );
        expect(owner).toMatchObject({
          account: "claimed",
          kind: "member",
          name: "Owner",
          status: "active",
        });
        const ids = Arr.map(active.page, (person) => person.id);
        expect(ids).toContain(fixture.invited);
        expect(ids).not.toContain(fixture.people.suspended.personId);
      })
  );

  it.effect(
    "lists only the unclaimed Persons, including one created after the hundredth active Person",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.run(claimedMembers(fixture.tenants.nf, 100));
        const made = yield* fixture
          .as("admin")
          .mutation(create, { name: "Guru Baru", slug: nf });
        const unclaimed = yield* fixture.as("admin").query(list, {
          ...firstPage,
          account: "unclaimed",
          slug: nf,
          status: "active",
        });
        expect(Arr.map(unclaimed.page, (person) => person.id)).toEqual([
          fixture.invited,
          made.id,
        ]);
      })
  );

  it.effect(
    "lists the teachers of the cohort's unit, and nobody the assignments refuse",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const admin = fixture.as("admin");
        const period = yield* admin.mutation(periods.create, {
          end: "2026-12-19",
          name: "Ganjil 2026/2027",
          slug: nf,
          start: "2026-07-13",
          unitId: fixture.units.smp,
        });
        const cohort = yield* admin.mutation(createCohort, {
          grade: 7,
          name: "7A",
          periodId: period.id,
          slug: nf,
        });
        const unit = yield* admin.mutation(create, { name: "Unit", slug: nf });
        const school = yield* admin.mutation(create, {
          name: "School",
          slug: nf,
        });
        const elsewhere = yield* admin.mutation(create, {
          name: "Elsewhere",
          slug: nf,
        });
        const learner = yield* admin.mutation(create, {
          name: "Learner",
          slug: nf,
        });
        yield* fixture.run(
          Effect.gen(function* () {
            const nfId = fixture.tenants.nf;
            const smp = fixture.units.smp;
            yield* grantRole(nfId, unit.id, "teacher", {
              kind: "unit",
              unitId: smp,
            });
            yield* grantRole(nfId, school.id, "teacher", { kind: "tenant" });
            yield* grantRole(nfId, elsewhere.id, "teacher", {
              kind: "unit",
              unitId: fixture.units.sd,
            });
            yield* grantRole(nfId, learner.id, "student", {
              kind: "unit",
              unitId: smp,
            });
          })
        );
        const page = yield* admin.query(teachers, {
          ...firstPage,
          cohortId: cohort.id,
          slug: nf,
        });
        const names = Arr.map(page.page, (person) => person.name);
        expect(names).toEqual(expect.arrayContaining(["Unit", "School"]));
        expect(names).not.toContain("Elsewhere");
        expect(names).not.toContain("Learner");
        const refused = yield* fixture
          .as("teacher")
          .query(teachers, { ...firstPage, cohortId: cohort.id, slug: nf })
          .pipe(Effect.flip);
        expect(refused).toMatchObject(denied("role"));
      })
  );

  it.effect("refuses the list to a student and to a unit's Admin", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const student = yield* fixture
        .as("student")
        .query(list, { ...firstPage, slug: nf, status: "active" })
        .pipe(Effect.flip);
      const unitAdmin = yield* fixture
        .as("unitAdmin")
        .query(list, { ...firstPage, slug: nf, status: "active" })
        .pipe(Effect.flip);
      expect([student, unitAdmin]).toMatchObject([
        denied("role"),
        denied("role"),
      ]);
    })
  );

  it.effect("creates an unclaimed member Person, and records it", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const made = yield* fixture
        .as("admin")
        .mutation(create, { name: "Guru Baru", slug: nf });
      expect(made).toEqual({
        account: "unclaimed",
        id: expect.any(String),
        kind: "member",
        name: "Guru Baru",
        status: "active",
      });
      expect(yield* fixture.run(journal)).toMatchObject([
        {
          actor: { id: fixture.people.admin.personId, kind: "person" },
          change: { type: "person.created" },
          subject: { id: made.id, kind: "person" },
        },
      ]);
    })
  );

  it.effect("refuses a create by a teacher and by a unit's Admin", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const teacher = yield* fixture
        .as("teacher")
        .mutation(create, { name: "Guru", slug: nf })
        .pipe(Effect.flip);
      const unitAdmin = yield* fixture
        .as("unitAdmin")
        .mutation(create, { name: "Guru", slug: nf })
        .pipe(Effect.flip);
      expect([teacher, unitAdmin]).toMatchObject([
        denied("role"),
        denied("role"),
      ]);
    })
  );
});

describe("tenancy/people students", () => {
  it.effect(
    "lists the active students of the school once each, and no teacher or Admin",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const listed = yield* fixture.as("admin").query(students, {
          paginationOpts: { cursor: null, numItems: 50 },
          slug: nf,
        });
        const ids = Arr.map(listed.page, (person) => person.id);
        expect(ids).toContain(fixture.people.student.personId);
        expect(ids).not.toContain(fixture.people.teacher.personId);
        expect(ids).not.toContain(fixture.people.admin.personId);
        expect(Arr.dedupe(ids)).toEqual(ids);
      })
  );
});
