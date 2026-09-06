import { afterEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("betterAuth/auth", () => {
  it.effect("exposes the schema without requiring deployment auth values", () =>
    Effect.gen(function* () {
      yield* Effect.sync(() => {
        vi.stubEnv("SITE_URL", undefined);
        vi.stubEnv("AUTH_GOOGLE_ID", undefined);
        vi.stubEnv("AUTH_GOOGLE_SECRET", undefined);
      });
      const { auth } = yield* Effect.promise(
        () => import("@repo/backend/convex/betterAuth/auth")
      );
      const context = yield* Effect.promise(() => auth.$context);

      expect(context.tables).toHaveProperty("user");
      expect(context.tables).toHaveProperty("session");
      expect(context.tables).toHaveProperty("account");
      expect(context.tables).toHaveProperty("jwks");
    })
  );
});
