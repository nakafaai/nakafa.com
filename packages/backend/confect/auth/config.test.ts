import { describe, expect, it } from "@effect/vitest";
import {
  GoogleAuthConfigError,
  readGoogleAuthConfig,
} from "@repo/backend/confect/auth/config";
import { JsonTextSchema } from "@repo/utilities/json";
import { ConfigProvider, Effect, Redacted, Schema } from "effect";

describe("auth/config", () => {
  it.effect("reads both credentials and keeps the secret redacted", () =>
    Effect.gen(function* () {
      const config = yield* readGoogleAuthConfig().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({
            AUTH_GOOGLE_ID: "client-id",
            AUTH_GOOGLE_SECRET: "client-secret",
          })
        )
      );

      expect(config.clientId).toBe("client-id");
      expect(Redacted.value(config.clientSecret)).toBe("client-secret");
      const serializedConfig = yield* Schema.encodeEffect(JsonTextSchema)(
        config
      ).pipe(Effect.orDie);
      expect(serializedConfig).not.toContain("client-secret");
    })
  );

  it.effect.each([
    [undefined, "private-secret"],
    ["", "private-secret"],
    [" ", "private-secret"],
    [" invalid-id ", "private-secret"],
    ["client-id", undefined],
    ["client-id", ""],
    ["client-id", " "],
    ["client-id", " private-secret "],
  ])(
    "rejects invalid Google credentials without exposing values",
    (credentials) =>
      Effect.gen(function* () {
        const failure = yield* readGoogleAuthConfig().pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromUnknown({
              AUTH_GOOGLE_ID: credentials[0],
              AUTH_GOOGLE_SECRET: credentials[1],
            })
          ),
          Effect.flip
        );

        expect(failure).toBeInstanceOf(GoogleAuthConfigError);
        expect(failure.code).toBe("AUTH_GOOGLE_CONFIG_INVALID");
        const serializedFailure = yield* Schema.encodeEffect(JsonTextSchema)(
          failure
        ).pipe(Effect.orDie);
        expect(serializedFailure).not.toContain("private-secret");
      })
  );
});
