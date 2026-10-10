import { describe, expect, it } from "@effect/vitest";
import { deriveKeys, open, seal } from "@repo/backend/confect/vault/cipher";
import { Array as Arr, Effect } from "effect";
import { Hex } from "effect/encoding";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const key = (fill: number) => new Uint8Array(32).fill(fill);
const text = encoder.encode("Kelas 12 IPA, ikut SNBT 2027.");

/** The failure reason of an attempt to open, or the opened text. */
const attempt = (
  keys: Effect.Success<ReturnType<typeof deriveKeys>>,
  binding: string,
  sealed: ArrayBuffer
) =>
  open(keys, binding, sealed).pipe(
    Effect.match({
      onFailure: (error) => error.reason,
      onSuccess: (plain) => decoder.decode(plain),
    })
  );

describe("vault cipher", () => {
  it.effect("opens what it sealed and never stores the text readable", () =>
    Effect.gen(function* () {
      const keys = yield* deriveKeys(key(1));
      const sealed = yield* seal(keys, "memory", text);
      expect(yield* attempt(keys, "memory", sealed)).toBe(
        "Kelas 12 IPA, ikut SNBT 2027."
      );
      expect(sealed.byteLength).toBe(1 + 12 + text.length + 16);
      expect(decoder.decode(sealed)).not.toContain("SNBT");
    })
  );

  it.effect(
    "seals the same text the same way and a different text under another nonce",
    () =>
      Effect.gen(function* () {
        const keys = yield* deriveKeys(key(1));
        const nonce = (sealed: ArrayBuffer) =>
          Arr.fromIterable(new Uint8Array(sealed).slice(1, 13));
        const first = yield* seal(keys, "memory", text);
        const again = yield* seal(keys, "memory", text);
        const other = yield* seal(keys, "memory", encoder.encode("Kelas 11."));
        const moved = yield* seal(keys, "summary", text);
        expect(new Uint8Array(again)).toEqual(new Uint8Array(first));
        expect(nonce(other)).not.toEqual(nonce(first));
        expect(nonce(moved)).not.toEqual(nonce(first));
      })
  );

  it.effect(
    "keeps the stored format: a fixed key, binding and text seal to the same bytes forever",
    () =>
      Effect.gen(function* () {
        const keys = yield* deriveKeys(key(7));
        const sealed = yield* seal(
          keys,
          "binding",
          encoder.encode("Kelas 12 IPA")
        );
        expect(Hex.encode(new Uint8Array(sealed))).toBe(
          "01bd2b8ff7aa3cd2d50f7c54ea1ec22d98a394b4a2d1b13e65f12a1f7713c7b36299f29b22909963f3"
        );
      })
  );

  it.effect(
    "never reuses a nonce when a binding is the start of another binding",
    () =>
      Effect.gen(function* () {
        const keys = yield* deriveKeys(key(1));
        const nonce = (sealed: ArrayBuffer) =>
          Arr.fromIterable(new Uint8Array(sealed).slice(1, 13));
        const short = yield* seal(keys, "memo", encoder.encode("ryX"));
        const long = yield* seal(keys, "memory", encoder.encode("X"));
        expect(nonce(short)).not.toEqual(nonce(long));
      })
  );

  it.effect("refuses another binding, another key and any changed byte", () =>
    Effect.gen(function* () {
      const keys = yield* deriveKeys(key(1));
      const sealed = yield* seal(keys, "memory", text);
      expect(yield* attempt(keys, "summary", sealed)).toBe("cipher");
      expect(yield* attempt(yield* deriveKeys(key(2)), "memory", sealed)).toBe(
        "cipher"
      );
      for (const index of [0, 1, 13, sealed.byteLength - 1]) {
        const changed = new Uint8Array(sealed.slice(0));
        changed.set([(changed[index] ?? 0) + 1], index);
        expect(yield* attempt(keys, "memory", changed.buffer)).toBe("cipher");
      }
      expect(yield* attempt(keys, "memory", sealed.slice(0, 28))).toBe(
        "cipher"
      );
    })
  );
});
