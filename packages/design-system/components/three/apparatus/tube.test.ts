// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  BURETTE,
  columnOf,
  meniscusOf,
  scaleOf,
  stripeOf,
} from "@repo/design-system/components/three/apparatus/tube";
import { Array as Arr, Option } from "effect";

const plain = (value: number, digits: number) => value.toFixed(digits);

describe("the meniscus of a burette", () => {
  it("stands at the zero mark when full and at the 50 mL mark when run out", () => {
    expect(meniscusOf(0)).toBe(BURETTE.zero);
    expect(meniscusOf(50)).toBeCloseTo(BURETTE.full);
  });

  it("falls by the same distance for every millilitre", () => {
    expect(meniscusOf(10) - meniscusOf(20)).toBeCloseTo(
      meniscusOf(30) - meniscusOf(40)
    );
    expect(meniscusOf(23.45)).toBeCloseTo(0.575 - 0.469 * 0.45, 6);
  });

  it("is held between the two end marks", () => {
    expect(meniscusOf(-4)).toBe(BURETTE.zero);
    expect(meniscusOf(80)).toBeCloseTo(BURETTE.full);
  });
});

describe("the titrant in a burette", () => {
  const column = columnOf(20);

  it("stands from the stopcock up the bore to the meniscus", () => {
    expect(column[0]).toEqual([0, BURETTE.stopcock]);
    expect(column[1]).toEqual([BURETTE.bore, BURETTE.stopcock]);
    expect(Option.getOrThrow(Arr.last(column))).toEqual([0, meniscusOf(20)]);
  });

  it("climbs the glass at the wall", () => {
    expect(column[2]?.[1]).toBeGreaterThan(meniscusOf(20));
    expect(
      Option.getOrThrow(Arr.get(column, column.length - 2))[1]
    ).toBeCloseTo(meniscusOf(20));
  });
});

describe("the scale of a burette", () => {
  const scale = scaleOf("blue", plain);
  const lines = Arr.filter(scale.sheet.marks, (mark) => mark.kind === "line");
  const texts = Arr.filter(scale.sheet.marks, (mark) => mark.kind === "text");

  it("marks every tenth of a millilitre and numbers every millilitre", () => {
    expect(lines).toHaveLength(501);
    expect(texts).toHaveLength(51);
    expect(Arr.map(Arr.take(texts, 3), (mark) => mark.text)).toEqual([
      "0",
      "1",
      "2",
    ]);
    expect(Option.getOrThrow(Arr.last(texts)).text).toBe("50");
  });

  it("reads downward, each mark at the height its meniscus stands at", () => {
    expect((lines[0]?.from[1] ?? 0) + scale.middle).toBeCloseTo(meniscusOf(0));
    expect((lines[500]?.from[1] ?? 0) + scale.middle).toBeCloseTo(
      meniscusOf(50)
    );
    expect(lines[0]?.to[0]).toBeGreaterThan(lines[0]?.from[0] ?? 0);
  });
});

describe("the Schellbach stripe", () => {
  it("is a white band with a narrow blue line along its middle", () => {
    const stripe = stripeOf("white", "blue");
    expect(stripe.ground).toBe("white");
    expect(stripe.marks).toHaveLength(1);
    expect(stripe.marks[0]?.ink).toBe("blue");
    expect(stripe.height).toBeCloseTo(BURETTE.top - BURETTE.full);
  });
});
