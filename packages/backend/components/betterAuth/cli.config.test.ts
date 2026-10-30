import { afterAll, describe, expect, it } from "@effect/vitest";
import { auth } from "@repo/backend/components/betterAuth/cli.config";
import { Effect } from "effect";

// The config reads the environment as it loads, so the deployment values go before the import, which vi.hoisted
// runs first. The static import loads the auth graph while the file is collected: inside the test, its cold load of
// the generated schema (10 s) ran past the 5 s test timeout.
vi.hoisted(() => {
  vi.stubEnv("SITE_URL", undefined);
  vi.stubEnv("GOOGLE_AUTH_CLIENT_ID", undefined);
  vi.stubEnv("GOOGLE_AUTH_CLIENT_SECRET", undefined);
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("betterAuth/cli.config", () => {
  it.effect("exposes the schema without requiring deployment auth values", () =>
    Effect.gen(function* () {
      const context = yield* Effect.promise(() => auth.$context);

      expect(context.tables).toHaveProperty("user");
      expect(context.tables).toHaveProperty("session");
      expect(context.tables).toHaveProperty("account");
      expect(context.tables).toHaveProperty("jwks");
    })
  );
});
