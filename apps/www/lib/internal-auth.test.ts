import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { timingSafeEqual } from "@/lib/internal-auth";

describe("internal auth", () => {
  it("accepts equal bearer tokens", async () => {
    await expect(
      Effect.runPromise(timingSafeEqual("secret", "secret"))
    ).resolves.toBe(true);
  });

  it("rejects unequal and missing bearer tokens", async () => {
    await expect(
      Effect.runPromise(timingSafeEqual("secret", "different"))
    ).resolves.toBe(false);
    await expect(
      Effect.runPromise(timingSafeEqual("secret", "secrex"))
    ).resolves.toBe(false);
    await expect(
      Effect.runPromise(timingSafeEqual(undefined, "secret"))
    ).resolves.toBe(false);
  });
});
