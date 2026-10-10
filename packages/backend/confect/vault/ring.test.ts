import { describe, expect, it } from "@effect/vitest";
import { readRing } from "@repo/backend/confect/vault/ring";
import { Array as Arr, ConfigProvider, Effect, HashMap, Order } from "effect";
import { Base64 } from "effect/encoding";

const key = (fill: number, bytes = 32) =>
  Base64.encode(new Uint8Array(bytes).fill(fill));

/** Reads the ring from one `VAULT_ROOT_KEYS` value; `undefined` leaves it unset. */
const read = (value: string | undefined) =>
  readRing().pipe(
    Effect.provide(
      ConfigProvider.layer(
        ConfigProvider.fromUnknown({ VAULT_ROOT_KEYS: value })
      )
    )
  );

describe("vault root keys", () => {
  it.effect(
    "wraps with the first key and keeps the rest only for unwrapping",
    () =>
      Effect.gen(function* () {
        const ring = yield* read(
          `new1:${key(1)},old1:${key(2)},old0:${key(3)}`
        );
        expect(ring.current.id).toBe("new1");
        expect(ring.retired).toEqual(["old1", "old0"]);
        expect(
          Arr.sort(Arr.fromIterable(HashMap.keys(ring.keys)), Order.String)
        ).toEqual(["new1", "old0", "old1"]);
        expect((yield* read(`only:${key(1)}`)).retired).toEqual([]);
      })
  );

  it.effect("rejects a missing or malformed value without echoing it", () =>
    Effect.gen(function* () {
      const secret = key(7);
      for (const value of [
        undefined,
        "",
        "new1",
        "new1:",
        "new1:not base64",
        `new1:${key(7, 16)}`,
        `New1:${secret}`,
        `new1:${secret}:extra`,
        `new1:${secret},`,
        `new1:${secret},new1:${key(8)}`,
      ]) {
        const error = yield* Effect.flip(read(value));
        expect(error.reason).toBe("configuration");
        expect(String(error)).not.toContain(secret);
      }
    })
  );
});
