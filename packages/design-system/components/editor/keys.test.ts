import { describe, expect, it } from "@effect/vitest";
import {
  KEY_SETS,
  keyFace,
  SET_SIGNS,
} from "@repo/design-system/components/editor/keys";
import { checkFormula } from "@repo/design-system/components/editor/render";
import { Array as Arr, Effect, Record as Rec } from "effect";

describe("the formula keypad's keys", () => {
  it.effect(
    "draws every key and every set's sign with KaTeX, chemistry's mhchem formulas included",
    () =>
      Effect.forEach(
        Arr.appendAll(
          Arr.map(Arr.flatten(Rec.values(KEY_SETS)), keyFace),
          Rec.values(SET_SIGNS)
        ),
        checkFormula,
        { discard: true }
      )
  );

  it("holds each key once in its set", () => {
    for (const keys of Rec.values(KEY_SETS)) {
      expect(Arr.dedupe(keys)).toHaveLength(keys.length);
    }
  });

  it("shows each slot of a key as an empty square", () => {
    expect(keyFace(String.raw`\frac{#@}{#?}`)).toBe(
      String.raw`\frac{\square}{\square}`
    );
  });
});
