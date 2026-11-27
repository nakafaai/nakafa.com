// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  cardOf,
  displayOf,
  needleOf,
  PIVOT,
  WINDOW,
} from "@repo/design-system/components/three/apparatus/face";
import { Array as Arr, Option } from "effect";

const plain = (value: number, digits: number) => value.toFixed(digits);
const inks = { accent: "red", ground: "white", ink: "black" };
const volts = {
  scale: { from: 0, major: 1, minor: 0.25, to: 3 },
  unit: "V",
};

describe("the needle of a moving-coil meter", () => {
  it("stands upright at the middle of its scale", () => {
    expect(needleOf(volts, 1.5)).toBeCloseTo(0);
  });

  it("leans left at the low end and right at the high end, by the same angle", () => {
    expect(needleOf(volts, 0)).toBeCloseTo(0.85);
    expect(needleOf(volts, 3)).toBeCloseTo(-0.85);
  });

  it("rests at the low end while nothing is read and is held on the scale", () => {
    expect(needleOf(volts, undefined)).toBeCloseTo(needleOf(volts, 0));
    expect(needleOf(volts, 12)).toBeCloseTo(needleOf(volts, 3));
  });
});

describe("the card of a moving-coil meter", () => {
  const card = cardOf(volts, inks, plain);
  const texts = Arr.filter(card.marks, (mark) => mark.kind === "text");

  it("fills the meter's window on its own ground", () => {
    expect(card.width).toBe(WINDOW.width);
    expect(card.height).toBe(WINDOW.height);
    expect(card.ground).toBe("white");
  });

  it("numbers the scale and names the unit in its accent", () => {
    expect(Arr.map(texts, (mark) => mark.text)).toEqual([
      "0",
      "1",
      "2",
      "3",
      "V",
    ]);
    expect(Option.map(Arr.last(texts), (mark) => mark.ink)).toEqual(
      Option.some("red")
    );
  });

  it("draws the arc the needle sweeps about the needle's pivot", () => {
    const arc = Arr.findFirst(card.marks, (mark) => mark.kind === "arc");
    expect(arc._tag === "Some" && arc.value.at).toEqual(PIVOT);
  });
});

describe("the display of a digital meter", () => {
  it("shows the reading and its unit", () => {
    const display = displayOf("1.10", "V", inks);
    expect(
      Arr.map(display.marks, (mark) => mark.kind === "text" && mark.text)
    ).toEqual(["1.10", "V"]);
    expect(display.ground).toBe("white");
  });

  it("is blank while it reads nothing", () => {
    expect(displayOf(undefined, "V", inks).marks).toEqual([]);
  });
});
