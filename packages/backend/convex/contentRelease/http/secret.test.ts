// @vitest-environment node

import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  bearerToken,
  matchesHttpSecret,
} from "@repo/backend/convex/contentRelease/http/secret";
import { Effect, Result } from "effect";

/** Compares one candidate at the Vitest runner boundary. */
function matches(candidate: string, secret: string) {
  return matchesHttpSecret(candidate, secret).pipe(Effect.result);
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
  it.live("timing-safely accepts only one exact non-whitespace secret", () =>
    Effect.gen(function* () {
      expect(yield* matches("technical-token", "technical-token")).toEqual(
        Result.succeed(true)
      );
      for (const [candidate, secret] of [
        ["foreign-token", "technical-token"],
        ["technical token", "technical token"],
        ["", ""],
      ]) {
        expect(yield* matches(candidate, secret)).toEqual(
          Result.succeed(false)
        );
      }
    })
  );
  it.live("fails closed when Web Crypto cannot derive a digest", () =>
    Effect.gen(function* () {
      vi.spyOn(crypto.subtle, "digest").mockRejectedValueOnce(
        new Error("digest unavailable")
      );
      expect(
        yield* matches("technical-token", "technical-token")
      ).toMatchObject({
        _tag: "Failure",
        failure: { _tag: "HttpSecretError" },
      });
    })
  );
});
