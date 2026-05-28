import { describe, expect, it } from "@effect/vitest";
import { parseLocale } from "@repo/backend/scripts/sync-content/schemas";
import { Effect, Exit } from "effect";

describe("sync-content schemas", () => {
  it.effect("parses supported locales", () =>
    Effect.gen(function* () {
      expect(yield* parseLocale("id", "flag")).toBe("id");
    })
  );

  it.effect("rejects unsupported locales with the accepted values", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(parseLocale("jp", "flag"));

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(exit.cause.toString()).toContain(
          'Invalid locale "jp" in flag. Expected:'
        );
        expect(exit.cause.toString()).toContain("id");
        expect(exit.cause.toString()).toContain("en");
      }
    })
  );
});
