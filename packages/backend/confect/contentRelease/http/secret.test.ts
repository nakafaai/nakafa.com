// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  bearerToken,
  matchesHttpSecret,
} from "@repo/backend/confect/contentRelease/http/secret";
import { Effect } from "effect";

describe("content release HTTP secret", () => {
  it("extracts only exact bearer credentials", () => {
    expect(bearerToken("Bearer technical-token")).toBe("technical-token");
    expect(bearerToken("bearer technical-token")).toBe("");
    expect(bearerToken("technical-token")).toBe("");
  });
  it.live("timing-safely accepts only one exact non-whitespace secret", () =>
    Effect.gen(function* () {
      expect(
        yield* matchesHttpSecret("technical-token", "technical-token")
      ).toBe(true);
      for (const [candidate, secret] of [
        ["foreign-token", "technical-token"],
        ["technical token", "technical token"],
        ["", ""],
      ]) {
        expect(yield* matchesHttpSecret(candidate, secret)).toBe(false);
      }
    })
  );
});
