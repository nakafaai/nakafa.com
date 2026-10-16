import { describe, expect, it } from "@effect/vitest";
import { testTextHash } from "@repo/backend/test/content/release";
import { sha256Hex } from "@repo/utilities/digest";
import { Effect } from "effect";

describe("technical text hash", () => {
  it("hashes the standard SHA-256 test vectors", () => {
    expect(testTextHash("")).toBe(
      "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
    expect(testTextHash("abc")).toBe(
      "sha256:ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it.effect("equals the Web Crypto hash that production computes", () =>
    Effect.gen(function* () {
      const text = "nakafa.aksara.tryout-placements\né中\u{1f600}\0";

      expect(testTextHash(text)).toBe(`sha256:${yield* sha256Hex(text)}`);
    })
  );
});
