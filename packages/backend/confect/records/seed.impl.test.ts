import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { Email, Npsn } from "@repo/backend/confect/tenancy/schema";
import {
  firstPage,
  keyedFixture,
  nf,
  openPeriod,
  period,
} from "@repo/backend/test/classroom";
import { TENANCY_NOW } from "@repo/backend/test/tenancy";
import { Effect, Schema } from "effect";

const seed = refs.internal.records.seed.graduation;

/** The NPSN a unit holds before the seed runs. */
const HELD_NPSN = Schema.decodeSync(Npsn)("69900001");
const graduations = refs.public.records.graduations;

type Fixture = Effect.Success<typeof keyedFixture>;

/** The seeded student's address, read from the account the fixture made. */
const studentAddress = (fixture: Fixture) =>
  fixture.run(
    Effect.flatMap(DatabaseReader, (reader) =>
      reader.table("users").get(fixture.users.student.userId)
    ).pipe(
      Effect.flatMap((user) => Schema.decodeEffect(Email)(user.email)),
      Effect.orDie
    )
  );

/** Opens an active period in the school's first active unit, its SMA unit. */
const openSma = Effect.fn("test.records.seed.openSma")(function* (
  fixture: Fixture
) {
  const term = yield* period(fixture, fixture.units.sma);
  yield* openPeriod(fixture, term.id);
});

describe("records seed graduation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
    vi.stubEnv("ACCEPTANCE_SEED", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it.effect("refuses the seed outside the acceptance runtime", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      vi.stubEnv("ACCEPTANCE_SEED", "false");
      expect(
        yield* fixture.internal
          .mutation(seed, { email: yield* studentAddress(fixture), slug: nf })
          .pipe(Effect.flip)
      ).toMatchObject({ _tag: "SeedRefused" });
    })
  );

  it.effect(
    "seeds a graduating class group whose student is ready but for the decision, once the report locks",
    () =>
      Effect.gen(function* () {
        const fixture = yield* keyedFixture;
        yield* openSma(fixture);
        const seeded = yield* fixture.internal.mutation(seed, {
          email: yield* studentAddress(fixture),
          slug: nf,
        });
        expect(seeded.cohort).toBe("12-Lulus");
        yield* fixture.finishScheduled();
        const sheet = yield* fixture.as("owner").query(graduations.sheet, {
          ...firstPage,
          cohortId: seeded.cohortId,
          slug: nf,
        });
        expect(sheet.page).toMatchObject([
          {
            hasNisn: true,
            missing: ["decision"],
            transcript: { average: 88.5 },
          },
        ]);
      })
  );

  it.effect("keeps the NPSN a unit already holds", () =>
    Effect.gen(function* () {
      const fixture = yield* keyedFixture;
      yield* openSma(fixture);
      yield* fixture.run(
        Effect.flatMap(DatabaseWriter, (writer) =>
          writer
            .table("tenantUnits")
            .patch(fixture.units.sma, { npsn: HELD_NPSN })
        ).pipe(Effect.orDie)
      );
      yield* fixture.internal.mutation(seed, {
        email: yield* studentAddress(fixture),
        slug: nf,
      });
      const unit = yield* fixture.run(
        Effect.flatMap(DatabaseReader, (reader) =>
          reader.table("tenantUnits").get(fixture.units.sma)
        ).pipe(Effect.orDie)
      );
      expect(unit.npsn).toBe(HELD_NPSN);
    })
  );
});
