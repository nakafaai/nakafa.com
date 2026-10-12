import { describe, expect, it } from "@effect/vitest";
import { Animal, DESIGNS } from "@repo/mascot/animal";
import { bird } from "@repo/mascot/family/bird";
import { bug } from "@repo/mascot/family/bug";
import { carnivore } from "@repo/mascot/family/carnivore";
import { farm } from "@repo/mascot/family/farm";
import { marine } from "@repo/mascot/family/marine";
import { primate } from "@repo/mascot/family/primate";
import { reptile } from "@repo/mascot/family/reptile";
import { small } from "@repo/mascot/family/small";
import { wild } from "@repo/mascot/family/wild";
import { type Design, INK } from "@repo/mascot/kit";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Number as Num, Order, Record as Rec } from "effect";

const HEX_COLOR = /^#[0-9a-f]{6}$/u;

const FAMILIES: readonly Record<string, Design>[] = [
  bird,
  bug,
  carnivore,
  farm,
  marine,
  primate,
  reptile,
  small,
  wild,
];

describe("mascot/animal", () => {
  it("names 65 animals, each once", () => {
    expect(Animal.literals).toHaveLength(65);
    expect(Arr.dedupe(Animal.literals)).toHaveLength(65);
  });

  it("gives every named animal one design, and every design a name", () => {
    expect(Arr.sort(Rec.keys(DESIGNS), Order.String)).toEqual(
      Arr.sort(Animal.literals, Order.String)
    );
  });

  it("draws no animal in two families", () => {
    expect(Num.sumAll(Arr.map(FAMILIES, (family) => Rec.size(family)))).toBe(
      65
    );
  });

  it("gives every animal at least one palette of two #rrggbb colours", () => {
    const palettes = Arr.flatMap(Rec.values(DESIGNS), ({ colors }) => colors);
    expect(palettes).toHaveLength(153);
    expect(
      Arr.every(palettes, (pair) =>
        Arr.every(pair, (color) => HEX_COLOR.test(color))
      )
    ).toBe(true);
    expect(
      Arr.every(Rec.values(DESIGNS), ({ colors }) => colors.length >= 1)
    ).toBe(true);
  });

  it("draws every animal differently from every other", () => {
    const kit = {
      body: "#ee8a4c",
      eyes: "open",
      ink: INK,
      look: 0,
      second: "#f4e6ce",
    } as const;
    const drawings = Arr.map(Rec.values(DESIGNS), ({ draw }) =>
      encodeJsonText(draw(kit))
    );
    expect(Arr.dedupe(drawings)).toHaveLength(65);
  });
});
