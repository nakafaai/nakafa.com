import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { nf } from "@repo/backend/test/classroom";
import {
  asStaffSchool,
  IBU,
  NISN,
  redeem,
  startLink,
} from "@repo/backend/test/guardians";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { code } = refs.internal.guardians.seed;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TENANCY_NOW);
  vi.stubEnv("ACCEPTANCE_SEED", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("guardians/seed", () => {
  it.effect(
    "puts the linked student's NISN on the roster and answers a live code for the address",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        yield* startLink(fixture);
        const seeded = yield* fixture.internal.mutation(code, {
          email: IBU,
          nisn: NISN,
          slug: "nf",
        });
        expect(seeded.code).toMatch(/^\d{6}$/);
        expect(
          yield* fixture.as("admin").query(refs.public.roster.entries.get, {
            personId: fixture.people.student.personId,
            slug: nf,
          })
        ).toMatchObject({ hasNisn: true, underAgeLimit: true });
        expect(yield* redeem(fixture, seeded.code)).toMatchObject({
          outcome: "signedIn",
        });
      })
  );

  it.effect("refuses outside the acceptance runtime", () =>
    Effect.gen(function* () {
      vi.stubEnv("ACCEPTANCE_SEED", "false");
      const fixture = yield* tenancyFixture;
      const refused = yield* Effect.flip(
        fixture.internal.mutation(code, { email: IBU, nisn: NISN, slug: "nf" })
      );
      expect(refused).toMatchObject({ _tag: "SeedRefused" });
    })
  );
});
