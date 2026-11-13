import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { components } from "@repo/backend/confect/_generated/components";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { nf } from "@repo/backend/test/classroom";
import {
  asStaffSchool,
  IBU,
  NISN,
  startLink,
} from "@repo/backend/test/guardians";
import {
  defectOf,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const { account } = refs.internal.guardians.seed;

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
    "puts the linked student's NISN on the roster and answers a password account that holds the guardian Person",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* asStaffSchool(fixture);
        const link = yield* startLink(fixture);
        const seeded = yield* fixture.internal.mutation(account, {
          email: IBU,
          nisn: NISN,
          slug: "nf",
        });
        expect(
          yield* fixture.as("admin").query(refs.public.roster.entries.get, {
            personId: fixture.people.student.personId,
            slug: nf,
          })
        ).toMatchObject({ hasNisn: true });
        const guardian = yield* fixture.run(
          Effect.flatMap(DatabaseReader, (reader) =>
            reader.table("tenantPeople").get(link.guardian.id)
          )
        );
        expect(guardian.account).toMatchObject({
          method: "address",
          state: "claimed",
          userId: seeded.userId,
        });
        // The browser test signs the parent in with the password it answers.
        const verified = yield* Effect.promise(() =>
          fixture.convex.mutation((ctx) =>
            ctx.runMutation(components.authPassword.public.verifyPassword, {
              password: seeded.password,
              userId: seeded.userId,
            })
          )
        );
        expect(verified).toEqual({ success: true });
      })
  );

  it.effect("dies for an address that no live link names", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      yield* asStaffSchool(fixture);
      const exit = yield* Effect.exit(
        fixture.internal.mutation(account, {
          email: IBU,
          nisn: NISN,
          slug: "nf",
        })
      );
      expect(defectOf(exit)).toContain("The address has no live link.");
    })
  );

  it.effect("refuses outside the acceptance runtime", () =>
    Effect.gen(function* () {
      vi.stubEnv("ACCEPTANCE_SEED", "false");
      const fixture = yield* tenancyFixture;
      const refused = yield* Effect.flip(
        fixture.internal.mutation(account, {
          email: IBU,
          nisn: NISN,
          slug: "nf",
        })
      );
      expect(refused).toMatchObject({ _tag: "SeedRefused" });
    })
  );
});
