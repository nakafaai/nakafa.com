// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { VESSELS } from "@repo/design-system/components/contents/biology/waste/pour";
import type { Waste } from "@repo/design-system/components/contents/biology/waste/route";
import {
  durationOf,
  nextOf,
  placeOf,
  pourOf,
  routeOf,
  slotOf,
  throughAutoclave,
} from "@repo/design-system/components/contents/biology/waste/route";
import {
  SHARPS,
  SINK,
  TRAY,
} from "@repo/design-system/components/contents/biology/waste/station";
import { Array as Arr, Option } from "effect";

const TRAY_OF_SIX: readonly [Waste, ...Waste[]] = [
  "culture",
  "blade",
  "glass",
  "salt",
  "solvent",
  "glove",
];

describe("where lab waste goes", () => {
  it("sends live microorganisms through the autoclave, sharps to the sharps container, and liquids by what they are", () => {
    expect(Arr.map(TRAY_OF_SIX, placeOf)).toEqual([
      "biohazard",
      "sharps",
      "glassBox",
      "sink",
      "chemical",
      "biohazard",
    ]);
    expect(placeOf("swab")).toBe("biohazard");
    expect(placeOf("slide")).toBe("sharps");
    expect(throughAutoclave("culture")).toBe(true);
    expect(throughAutoclave("salt")).toBe(false);
  });

  it("pours the salt solution onto the sink's floor and drops everything solid", () => {
    const sink = Option.getOrThrow(pourOf("sink"));
    expect(sink.vessel).toBe(VESSELS.salt);
    expect(sink.end).toBeCloseTo(0.003 - SINK.depth, 12);
    expect(Option.getOrThrow(pourOf("chemical")).vessel).toBe(VESSELS.solvent);
    expect(Option.isNone(pourOf("sharps"))).toBe(true);
  });

  it("holds the sharps container's 2.5 L in a body 176 mm wide and 163 mm tall", () => {
    expect(SHARPS.width * SHARPS.height * SHARPS.depth).toBeCloseTo(0.0025, 12);
  });
});

describe("the tray", () => {
  it("puts a lone item in the middle", () => {
    expect(slotOf(0, 1)).toEqual([TRAY.at[0], TRAY.floor, TRAY.at[2]]);
  });

  it("sets six items in two rows of three, each inside the tray and apart from the others", () => {
    const slots = Arr.map(TRAY_OF_SIX, (_, index) => slotOf(index, 6));
    for (const [x, , z] of slots) {
      expect(Math.abs(x - TRAY.at[0])).toBeLessThan(TRAY.width / 2);
      expect(Math.abs(z - TRAY.at[2])).toBeLessThan(TRAY.depth / 2);
    }
    expect(slots[0]?.[2]).toBe(slots[2]?.[2]);
    expect(slots[3]?.[2]).toBeGreaterThan(slots[0]?.[2] ?? 0);
    expect(Arr.dedupe(Arr.map(slots, ([x, , z]) => `${x},${z}`))).toHaveLength(
      6
    );
  });
});

describe("a route", () => {
  it("lifts, carries and drops a blade into the sharps container", () => {
    const route = routeOf("blade", slotOf(1, 6));
    expect(Arr.map(route.legs, (leg) => leg.kind)).toEqual([
      "lift",
      "carry",
      "drop",
    ]);
    expect(route.rest[1]).toBeLessThan(SHARPS.height);
    expect(route.entry[1]).toBeGreaterThan(SHARPS.height);
  });

  it("drops a culture into the bag, then loads it into the autoclave and runs the cycle", () => {
    const route = routeOf("culture", slotOf(0, 6));
    expect(Arr.map(route.legs, (leg) => leg.kind)).toEqual([
      "lift",
      "carry",
      "drop",
      "pause",
      "open",
      "load",
      "close",
      "heat",
    ]);
    expect(durationOf(route)).toBeCloseTo(
      Arr.reduce(route.legs, 0, (sum, leg) => sum + leg.to - leg.from),
      12
    );
  });

  it("tips and pours a liquid instead of dropping it", () => {
    expect(
      Arr.map(routeOf("solvent", slotOf(4, 6)).legs, (leg) => leg.kind)
    ).toEqual(["lift", "carry", "tip", "pour"]);
  });

  it("carries a short way at its shortest and a long way at its longest", () => {
    const near = routeOf("salt", [SINK.at[0], 0, SINK.at[2] + 0.2]);
    const far = routeOf("glove", [-2, 0, 2]);
    const carry = (legs: typeof near.legs) =>
      Option.match(
        Arr.findFirst(legs, (leg) => leg.kind === "carry"),
        { onNone: () => 0, onSome: (leg) => leg.to - leg.from }
      );
    expect(carry(near.legs)).toBeCloseTo(0.8, 12);
    expect(carry(far.legs)).toBeCloseTo(1.6, 12);
  });
});

describe("playing through the tray", () => {
  it("moves to the next item and wraps to the first", () => {
    expect(nextOf(TRAY_OF_SIX, "culture")).toBe("blade");
    expect(nextOf(TRAY_OF_SIX, "glove")).toBe("culture");
    expect(nextOf(TRAY_OF_SIX, "swab")).toBe("culture");
  });
});
