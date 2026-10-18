import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { Email } from "@repo/backend/confect/tenancy/schema";
import { journal, slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Schema } from "effect";

const seedTeacher = refs.internal.tenancy.seed.teacher;
const teacherAddress = Schema.decodeSync(Email)("guru@acceptance.example.test");

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
