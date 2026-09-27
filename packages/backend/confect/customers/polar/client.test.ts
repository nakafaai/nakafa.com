import { describe, expect, it } from "@effect/vitest";
import { readPolarClient } from "@repo/backend/confect/customers/polar/client";
import { ConfigProvider, Effect } from "effect";

describe("Polar client configuration", () => {
  it.effect("selects the configured environment without making a request", () =>
    Effect.gen(function* () {
      for (const server of ["production", "sandbox"]) {
        const client = yield* readPolarClient().pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromEnv({
              env: {
                POLAR_ACCESS_TOKEN: "polar_test",
                NEXT_PUBLIC_POLAR_SERVER: server,
              },
            })
          )
        );
        expect(client._options.server).toBe(server);
        expect(client._options.accessToken).toBe("polar_test");
      }
      const client = yield* readPolarClient().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnv({ env: { POLAR_ACCESS_TOKEN: "polar_test" } })
        )
      );
      expect(client._options.server).toBe("sandbox");
    })
  );
  it.effect(
    "rejects absent credentials and invalid environments without exposing secrets",
    () =>
      Effect.gen(function* () {
        for (const env of [
          {},
          { POLAR_ACCESS_TOKEN: "" },
          {
            POLAR_ACCESS_TOKEN: "polar_test",
            NEXT_PUBLIC_POLAR_SERVER: "invalid",
          },
        ]) {
          const error = yield* readPolarClient().pipe(
            Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromEnv({ env })
            ),
            Effect.flip
          );
          expect(error._tag).toBe("PolarConfigError");
          expect(error.message).not.toContain("polar_test");
        }
      })
  );
});
