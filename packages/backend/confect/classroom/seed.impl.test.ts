import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { teacherAssignment } from "@repo/backend/confect/classroom/teacher";
import { Email } from "@repo/backend/confect/tenancy/schema";
import {
  nf,
  openPeriod,
  period,
  writeClass,
} from "@repo/backend/test/classroom";
import { archiveUnit } from "@repo/backend/test/exams";
import { journal, slugOf, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect, Option, Schema } from "effect";

const seedTeacher = refs.internal.classroom.seed.teacher;
const classes = refs.public.classroom.classes;
const teacherAddress = Schema.decodeSync(Email)(
  "kelas@acceptance.example.test"
);

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

/** The seed's arguments for the school `nf`, with one class of the given subject. */
const seedArguments = {
  email: teacherAddress,
  locale: "id",
  name: "Guru Kelas",
  slug: slugOf("nf"),
  subject: "Fisika",
} as const;

describe("classroom/seed teacher", () => {
  it.effect(
    "seeds a class of an open period, taught by an unclaimed Teacher with an invite",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const seeded = yield* fixture.internal.mutation(
          seedTeacher,
          seedArguments
        );
        const made = yield* fixture
          .as("admin")
          .query(classes.get, { classId: seeded.classId, slug: nf });
        const taught = yield* fixture.run(
          teacherAssignment(seeded.classId, seeded.person).pipe(
            Effect.map(Option.isSome)
          )
        );
        const entries = yield* fixture.run(journal);
        expect(made).toMatchObject({
          name: "Fisika X-1",
          periodId: seeded.periodId,
          status: "active",
          subject: "Fisika",
        });
        expect(taught).toBe(true);
        expect(entries).toContainEqual(
          expect.objectContaining({
            change: { type: "class.created" },
          })
        );
      })
  );

  it.effect(
    "seeds the class at the next number while a class of another unit holds its address",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        // The seed takes the first active unit of the school, SMA, so the other unit holds the address.
        yield* writeClass(
          fixture,
          fixture.units.smp,
          "fisika-x-1",
          "planned",
          "active"
        );
        const seeded = yield* fixture.internal.mutation(
          seedTeacher,
          seedArguments
        );
        const made = yield* fixture
          .as("admin")
          .query(classes.get, { classId: seeded.classId, slug: nf });
        expect(made).toMatchObject({ slug: "fisika-x-1-2" });
      })
  );

  it.effect("seeds the class in the active period the school already has", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* fixture.run(archiveUnit(fixture.units.smp));
      const term = yield* period(fixture, fixture.units.sma);
      yield* openPeriod(fixture, term.id);
      const seeded = yield* fixture.internal.mutation(
        seedTeacher,
        seedArguments
      );
      expect(seeded.periodId).toBe(term.id);
    })
  );

  it.effect("refuses a school that no tenant has", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const refusal = yield* fixture.internal
        .mutation(seedTeacher, {
          ...seedArguments,
          slug: slugOf("tidak-ada"),
        })
        .pipe(Effect.flip);
      expect(refusal).toMatchObject({ _tag: "TenantNotFound" });
    })
  );

  it.effect("refuses a school whose units are all archived", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* fixture.run(archiveUnit(fixture.units.smp));
      yield* fixture.run(archiveUnit(fixture.units.sma));
      const refusal = yield* fixture.internal
        .mutation(seedTeacher, seedArguments)
        .pipe(Effect.flip);
      expect(refusal).toMatchObject({ _tag: "SeedUnitMissing" });
    })
  );

  it.effect(
    "refuses to seed outside the acceptance runtime, and writes no class",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const before = yield* fixture.run(journal);
        vi.stubEnv("ACCEPTANCE_SEED", "false");
        const refusal = yield* fixture.internal
          .mutation(seedTeacher, seedArguments)
          .pipe(Effect.flip);
        const after = yield* fixture.run(journal);
        expect(refusal).toMatchObject({ _tag: "SeedRefused" });
        expect(after).toEqual(before);
      })
  );
});
