// @vitest-environment node

import {
  bearerToken,
  matchesHttpSecret,
} from "@repo/backend/convex/contentRelease/http/secret";
import { Effect, Either } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

/** Compares one candidate at the Vitest runner boundary. */
function matches(candidate: string, secret: string) {
  return Effect.runPromise(
    matchesHttpSecret(candidate, secret).pipe(Effect.either)
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("content release HTTP secret", () => {
  it("extracts only exact bearer credentials", () => {
    expect(bearerToken("Bearer technical-token")).toBe("technical-token");
    expect(bearerToken("bearer technical-token")).toBe("");
    expect(bearerToken("technical-token")).toBe("");
  });

  it("timing-safely accepts only one exact non-whitespace secret", async () => {
    await expect(
      matches("technical-token", "technical-token")
    ).resolves.toEqual(Either.right(true));
    for (const [candidate, secret] of [
      ["foreign-token", "technical-token"],
      ["technical token", "technical token"],
      ["", ""],
    ]) {
      await expect(matches(candidate, secret)).resolves.toEqual(
        Either.right(false)
      );
    }
  });

  it("fails closed when Web Crypto cannot derive a digest", async () => {
    vi.spyOn(crypto.subtle, "digest").mockRejectedValueOnce(
      new Error("digest unavailable")
    );

    await expect(
      matches("technical-token", "technical-token")
    ).resolves.toMatchObject({
      _tag: "Left",
      left: { _tag: "HttpSecretError" },
    });
  });
});
