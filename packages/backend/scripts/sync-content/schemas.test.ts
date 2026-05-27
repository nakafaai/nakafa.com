import { parseLocale } from "@repo/backend/scripts/sync-content/schemas";
import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

describe("sync-content schemas", () => {
  it("parses supported locales", async () => {
    await expect(Effect.runPromise(parseLocale("id", "flag"))).resolves.toBe(
      "id"
    );
  });

  it("rejects unsupported locales with the accepted values", async () => {
    const exit = await Effect.runPromiseExit(parseLocale("jp", "flag"));

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(exit.cause.toString()).toContain(
        'Invalid locale "jp" in flag. Expected:'
      );
      expect(exit.cause.toString()).toContain("id");
      expect(exit.cause.toString()).toContain("en");
    }
  });
});
