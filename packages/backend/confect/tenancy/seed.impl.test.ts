import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { archiveUnit } from "@repo/backend/test/exams";
import {
  claimedMembers,
  defectOf,
  journal,
  slugOf,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Exit, Schema } from "effect";

const seedTeacher = refs.internal.tenancy.seed.teacher;
const seedStudent = refs.internal.tenancy.seed.student;
const teacherAddress = Schema.decodeSync(Email)("guru@acceptance.example.test");
const memberAddress = Schema.decodeSync(Email)("member-0@example.com");
const unknownAddress = Schema.decodeSync(Email)("tidak-ada@example.com");
const walkInAddress = Schema.decodeSync(Email)("walk-in@example.com");

/**
 * Fake timers keep the invitation workflow from starting before the test looks at the invite.
 * The flag lets the seed run, as the acceptance runtime sets it.
 */
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("ACCEPTANCE_SEED", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("tenancy/seed teacher", () => {
  it.effect(
    "seeds an unclaimed Teacher, with an invite and a teacher grant over the school",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const seeded = yield* fixture.internal.mutation(seedTeacher, {
          email: teacherAddress,
          locale: "id",
          name: "Guru Acceptance",
          slug: slugOf("nf"),
        });
        const entries = yield* fixture.run(journal);
        const grants = yield* fixture
          .as("admin")
          .query(refs.public.access.grants.list, {
            paginationOpts: { cursor: null, numItems: 100 },
            slug: slugOf("nf"),
          });
        const invites = yield* fixture
          .as("admin")
          .query(refs.public.tenancy.invites.list, {
            paginationOpts: { cursor: null, numItems: 100 },
            slug: slugOf("nf"),
          });
        expect(Arr.map(grants.page, (row) => row.person)).toContainEqual({
          id: seeded.person,
          name: "Guru Acceptance",
        });
        expect(grants.page).toContainEqual(
          expect.objectContaining({
            person: { id: seeded.person, name: "Guru Acceptance" },
            role: { key: "teacher", kind: "builtin" },
            scope: { kind: "tenant" },
          })
        );
        expect(Arr.map(invites.page, (row) => row.id)).toContain(seeded.invite);
        expect(entries).toContainEqual(
          expect.objectContaining({
            actor: { kind: "system" },
            change: { type: "person.created" },
            subject: { id: seeded.person, kind: "person" },
          })
        );
      })
  );

  it.effect("refuses a school that no tenant has", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const refusal = yield* fixture.internal
        .mutation(seedTeacher, {
          email: teacherAddress,
          locale: "id",
          name: "Guru Acceptance",
          slug: slugOf("tidak-ada"),
        })
        .pipe(Effect.flip);
      expect(refusal).toMatchObject({ _tag: "TenantNotFound" });
    })
  );

  it.effect(
    "refuses to seed outside the acceptance runtime, and writes no person",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const before = yield* fixture.run(journal);
        vi.stubEnv("ACCEPTANCE_SEED", "false");
        const refusal = yield* fixture.internal
          .mutation(seedTeacher, {
            email: teacherAddress,
            locale: "id",
            name: "Guru Acceptance",
            slug: slugOf("nf"),
          })
          .pipe(Effect.flip);
        expect(refusal).toMatchObject({
          _tag: "SeedRefused",
          code: "SEED_REFUSED",
        });
        expect(yield* fixture.run(journal)).toEqual(before);
      })
  );
});

describe("tenancy/seed student", () => {
  it.effect(
    "grants a member of the school the student role over one of its active units",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.run(claimedMembers(fixture.tenants.nf, 1));
        yield* fixture.internal.mutation(seedStudent, {
          email: memberAddress,
          slug: slugOf("nf"),
        });
        const grants = yield* fixture
          .as("admin")
          .query(refs.public.access.grants.list, {
            paginationOpts: { cursor: null, numItems: 100 },
            slug: slugOf("nf"),
          });
        expect(grants.page).toContainEqual(
          expect.objectContaining({
            person: { id: expect.any(String), name: "Member 0" },
            role: { key: "student", kind: "builtin" },
            scope: { kind: "unit", unitId: expect.any(String) },
          })
        );
      })
  );

  it.effect("refuses a school that no tenant has", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const refusal = yield* fixture.internal
        .mutation(seedStudent, {
          email: memberAddress,
          slug: slugOf("tidak-ada"),
        })
        .pipe(Effect.flip);
      expect(refusal).toMatchObject({ _tag: "TenantNotFound" });
    })
  );

  it.effect("dies when the school has no active unit", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* fixture.run(archiveUnit(fixture.units.smp));
      yield* fixture.run(archiveUnit(fixture.units.sma));
      const exit = yield* Effect.exit(
        fixture.internal.mutation(seedStudent, {
          email: memberAddress,
          slug: slugOf("nf"),
        })
      );
      expect(Exit.isFailure(exit)).toBe(true);
      expect(defectOf(exit)).toContain("The school has no active unit.");
    })
  );

  it.effect("dies when no account holds the address", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const exit = yield* Effect.exit(
        fixture.internal.mutation(seedStudent, {
          email: unknownAddress,
          slug: slugOf("nf"),
        })
      );
      expect(defectOf(exit)).toContain("No account holds this address.");
    })
  );

  it.effect(
    "dies when the address holds an account that is no member of the school",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.account("walk-in", "walk-in@example.com", true);
        const exit = yield* Effect.exit(
          fixture.internal.mutation(seedStudent, {
            email: walkInAddress,
            slug: slugOf("nf"),
          })
        );
        expect(defectOf(exit)).toContain(
          "This address is not a member of the school."
        );
      })
  );
});
