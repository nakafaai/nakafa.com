import { afterEach, describe, expect, it } from "@effect/vitest";
import { matchesSecret, sha256, sha256Hex } from "@repo/utilities/digest";
import { Effect, Result } from "effect";
import { Hex } from "effect/encoding";

const EMPTY_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const ABC_SHA256 =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const NON_ASCII_TEXT = "café 学習 🙂";
const NON_ASCII_SHA256 =
  "0e73a6148aa51126fc1886af9de3c4a1327280858cf20b0f362466778a40309f";

const utf8 = (text: string) => new TextEncoder().encode(text);

describe("utilities/digest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.effect("hashes text to lower-case SHA-256 hexadecimal", () =>
    Effect.gen(function* () {
      expect(yield* sha256Hex("")).toBe(EMPTY_SHA256);
      expect(yield* sha256Hex("abc")).toBe(ABC_SHA256);
      expect(yield* sha256Hex(NON_ASCII_TEXT)).toBe(NON_ASCII_SHA256);
    })
  );

  it.effect("returns the digest bytes that the hexadecimal form encodes", () =>
    Effect.gen(function* () {
      const hex = yield* sha256Hex(NON_ASCII_TEXT);
      const bytes = yield* sha256(utf8(NON_ASCII_TEXT));

      expect(bytes).toHaveLength(32);
      expect(Hex.decode(hex)).toEqual(Result.succeed(bytes));
    })
  );

  it.effect("accepts equal secrets, including two empty values", () =>
    Effect.gen(function* () {
      expect(yield* matchesSecret("technical-token", "technical-token")).toBe(
        true
      );
      expect(yield* matchesSecret("café", "café")).toBe(true);
      // Callers own the emptiness rule, so the comparison accepts the pair.
      expect(yield* matchesSecret("", "")).toBe(true);
    })
  );

  it.effect("rejects different secrets of equal and different length", () =>
    Effect.gen(function* () {
      expect(yield* matchesSecret("secret-token", "secret-tokem")).toBe(false);
      expect(yield* matchesSecret("secret", "secret-token")).toBe(false);
      expect(yield* matchesSecret("secret-token", "secret")).toBe(false);
      expect(yield* matchesSecret("café", "cafe")).toBe(false);
    })
  );

  it.effect("digests both values before it compares them", () =>
    Effect.gen(function* () {
      const digest = vi.spyOn(crypto.subtle, "digest");

      expect(yield* matchesSecret("foreign-token", "technical-token")).toBe(
        false
      );

      expect(digest).toHaveBeenCalledTimes(2);
    })
  );

  it.effect("fails with a PlatformError when the digest is rejected", () =>
    Effect.gen(function* () {
      vi.spyOn(crypto.subtle, "digest").mockRejectedValue(
        new Error("digest unavailable")
      );

      const shaFailure = yield* sha256(utf8("abc")).pipe(Effect.flip);
      const hexFailure = yield* sha256Hex("abc").pipe(Effect.flip);
      const secretFailure = yield* matchesSecret("abc", "abc").pipe(
        Effect.flip
      );

      expect(shaFailure).toMatchObject({ _tag: "PlatformError" });
      expect(hexFailure).toMatchObject({ _tag: "PlatformError" });
      expect(secretFailure).toMatchObject({ _tag: "PlatformError" });
    })
  );
});
