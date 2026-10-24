import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { required } from "@repo/backend/confect/acceptance/lookup";
import { activeGrants } from "@repo/backend/confect/access/policy";
import { DEVICE, nf, PASSWORD, redeemOn } from "@repo/backend/test/identity";
import {
  defectOf,
  slugOf,
  TENANCY_NOW,
  tenancyFixture,
} from "@repo/backend/test/tenancy";
import { Array as Arr, Effect, Exit } from "effect";

const seed = refs.internal.identity.seed.card;

describe("identity seed card", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TENANCY_NOW);
    vi.stubEnv("ACCEPTANCE_SEED", "true");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.effect("refuses the seed outside the acceptance runtime", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      vi.stubEnv("ACCEPTANCE_SEED", "false");
      const refusal = yield* fixture.internal
        .mutation(seed, { slug: nf })
        .pipe(Effect.flip);
      expect(refusal).toMatchObject({
        _tag: "SeedRefused",
        code: "SEED_REFUSED",
      });
    })
  );

  it.effect(
    "gives a new student a student grant, and a card that the school host redeems",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        const printed = yield* fixture.internal.mutation(seed, { slug: nf });
        const grants = yield* fixture.run(
          Effect.gen(function* () {
            const login = yield* required(
              yield* (yield* DatabaseReader)
                .table("schoolLogins")
                .index("by_tenantId_and_name", (query) =>
                  query
                    .eq("tenantId", fixture.tenants.nf)
                    .eq("name", printed.loginName)
                )
                .first()
                .pipe(Effect.orDie),
              "The seeded login is missing."
            );
            return yield* activeGrants(login.personId);
          })
        );
        expect(Arr.map(grants, (grant) => grant.role.key)).toEqual(["student"]);
        const outcome = yield* redeemOn(
          fixture,
          printed.code,
          PASSWORD,
          DEVICE,
          nf,
          printed.loginName
        );
        expect(outcome).toEqual({
          loginName: printed.loginName,
          outcome: "redeemed",
        });
      })
  );

  it.effect("refuses a school that no slug names", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const exit = yield* Effect.exit(
        fixture.internal.mutation(seed, { slug: slugOf("tidak-ada") })
      );
      expect(Exit.isFailure(exit)).toBe(true);
      expect(defectOf(exit)).toContain("No school has this slug.");
    })
  );
});
