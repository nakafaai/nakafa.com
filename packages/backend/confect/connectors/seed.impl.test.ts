import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import { nf } from "@repo/backend/test/identity";
import { TENANCY_NOW, tenancyFixture } from "@repo/backend/test/tenancy";
import { Effect } from "effect";

const seed = refs.internal.connectors.seed.connection;

describe("connector seed", () => {
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
      const fixture = yield* tenancyFixture;
      vi.stubEnv("ACCEPTANCE_SEED", "false");
      const refusal = yield* fixture.internal
        .mutation(seed, { slug: nf, status: "active" })
        .pipe(Effect.flip);
      expect(refusal).toMatchObject({ _tag: "SeedRefused" });
    })
  );

  it.effect(
    "stores a school's Classroom connection in the state it names",
    () =>
      Effect.gen(function* () {
        const fixture = yield* tenancyFixture;
        yield* fixture.internal.mutation(seed, {
          slug: nf,
          status: "reconnect",
        });
        const stored = yield* Effect.promise(() =>
          fixture.convex.run((ctx) =>
            ctx.db.query("connectorConnections").collect()
          )
        );
        expect(stored).toMatchObject([
          {
            connector: "classroom",
            owner: { kind: "tenant" },
            status: "reconnect",
          },
        ]);
      })
  );
});
