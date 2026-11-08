import { describe, expect, it } from "@effect/vitest";
import { Layout, paidFor } from "@repo/backend/confect/island/layout";
import { STARTER_LAYOUT } from "@repo/backend/confect/island/starter";
import { Array as Arr, Effect, Schema } from "effect";

/** A layout of one record, written byte by byte as a stored island holds it. */
function packed(record: readonly number[]) {
  return Uint8Array.from(record).buffer;
}

describe("island/layout", () => {
  it.effect("packs ten bytes a placement and reads them back", () =>
    Effect.gen(function* () {
      const stored = yield* Schema.encodeEffect(Layout)(STARTER_LAYOUT);
      expect(stored.byteLength).toBe(20);
      expect(Arr.fromIterable(new Uint8Array(stored, 0, 10))).toEqual([
        1, 0, 3, 2, 0, 0, 0, 0, 0, 0,
      ]);
      expect(yield* Schema.decodeEffect(Layout)(stored)).toEqual(
        STARTER_LAYOUT
      );
    })
  );

  it.effect("stores turn, stage, paid Stars and growth in their bytes", () =>
    Effect.gen(function* () {
      const placement = {
        growth: 300,
        item: "tree" as const,
        paid: 1025,
        rotation: 3,
        stage: 2,
        x: 23,
        y: 4,
        z: 7,
      };
      const stored = yield* Schema.encodeEffect(Layout)([placement]);
      expect(Arr.fromIterable(new Uint8Array(stored))).toEqual([
        2, 0, 23, 4, 7, 0b1011, 1, 4, 44, 1,
      ]);
      expect(yield* Schema.decodeEffect(Layout)(stored)).toEqual([placement]);
    })
  );

  it.effect(
    "refuses a buffer of broken records, an unknown item, or a cell off the island",
    () =>
      Effect.gen(function* () {
        const decode = Schema.decodeUnknownEffect(Layout);
        expect(
          (yield* Effect.flip(decode(new ArrayBuffer(7)))).message
        ).toContain("whole records");
        expect(
          (yield* Effect.flip(decode(packed([99, 0, 0, 0, 0, 0, 0, 0, 0, 0]))))
            .message
        ).toContain("Unknown island item");
        yield* Effect.flip(decode(packed([1, 0, 24, 0, 0, 0, 0, 0, 0, 0])));
        yield* Effect.flip(decode(packed([1, 0, 0, 0, 8, 0, 0, 0, 0, 0])));
        yield* Effect.flip(
          decode(packed([1, 0, 0, 0, 0, 0b1_0000, 0, 0, 0, 0]))
        );
      })
  );

  it("sums what the placements paid", () => {
    expect(paidFor(STARTER_LAYOUT)).toBe(0);
    expect(
      paidFor(
        Arr.map(STARTER_LAYOUT, (placement, index) => ({
          ...placement,
          paid: index === 0 ? 60 : 15,
        }))
      )
    ).toBe(75);
  });
});
