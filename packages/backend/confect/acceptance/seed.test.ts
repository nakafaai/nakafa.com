import { describe, expect, it } from "@effect/vitest";
import {
  requireAcceptanceSeed,
  SeedRefused,
} from "@repo/backend/confect/acceptance/seed";
import { ConfigProvider, Effect } from "effect";

/** Runs the guard with the given environment in place of the deployment's. */
const guardWith = (environment: Record<string, string>) =>
  requireAcceptanceSeed().pipe(
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromUnknown(environment)
    )
  );

describe("acceptance seed", () => {
  it.effect("lets a seed run when the acceptance runtime sets the flag", () =>
    Effect.gen(function* () {
      expect(yield* guardWith({ ACCEPTANCE_SEED: "true" })).toBeUndefined();
    })
  );

  it.effect("refuses a seed when the flag is false", () =>
    Effect.gen(function* () {
      const refusal = yield* guardWith({ ACCEPTANCE_SEED: "false" }).pipe(
        Effect.flip
      );
      expect(refusal).toBeInstanceOf(SeedRefused);
    })
  );

  it.effect(
    "refuses a seed when the flag is absent, as production and development do",
    () =>
      Effect.gen(function* () {
        const refusal = yield* guardWith({}).pipe(Effect.flip);
        expect(refusal).toMatchObject({
          _tag: "SeedRefused",
          code: "SEED_REFUSED",
        });
      })
  );
});
