// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import {
  arrivalOf,
  cornerName,
  facingAt,
  farthestOf,
  lengthOf,
  motionOf,
  partAt,
  partName,
  placeAt,
  speedOf,
  stagesOf,
  totalsOf,
} from "@repo/design-system/components/contents/mathematics/journey/trip";
import { Array as Arr } from "effect";

/** A bus that goes out 12 km, waits, goes 8 km more, waits at the end of the line, and comes back. */
const BUS = stagesOf({
  depart: 0,
  from: 0,
  legs: [
    { change: 12, minutes: 15 },
    { change: 0, minutes: 10 },
    { change: 8, minutes: 20 },
    { change: 0, minutes: 15 },
    { change: -20, minutes: 30 },
  ],
});

describe("a journey on the clock", () => {
  it("places each leg after the last, from where the traveller leaves", () => {
    expect(Arr.getUnsafe(BUS, 2)).toEqual({
      end: 45,
      from: 12,
      start: 25,
      to: 20,
    });
    expect(arrivalOf(BUS)).toBe(90);
    const later = stagesOf({
      depart: 10,
      from: 20,
      legs: [{ change: -20, minutes: 40 }],
    });
    expect(later).toEqual([{ end: 50, from: 20, start: 10, to: 0 }]);
  });

  it("finds the distance from the start at any minute, waiting before and after", () => {
    expect(placeAt(BUS, -5)).toBe(0);
    expect(placeAt(BUS, 7.5)).toBe(6);
    expect(placeAt(BUS, 20)).toBe(12);
    expect(placeAt(BUS, 75)).toBe(10);
    expect(placeAt(BUS, 120)).toBe(0);
  });

  it("gives the moment a leg ends to that leg", () => {
    expect(partAt(BUS, 0)).toBe(0);
    expect(partAt(BUS, 15)).toBe(0);
    expect(partAt(BUS, 15.5)).toBe(1);
    expect(partAt(BUS, 90)).toBe(4);
    expect(partAt(BUS, 200)).toBe(4);
  });

  it("names the corners O, A, B and on, and each leg by its two corners", () => {
    expect(Arr.makeBy(4, cornerName)).toEqual(["O", "A", "B", "C"]);
    expect(Arr.makeBy(BUS.length, partName)).toEqual([
      "OA",
      "AB",
      "BC",
      "CD",
      "DE",
    ]);
  });

  it("reads what each leg does and how fast it goes", () => {
    expect(Arr.map(BUS, motionOf)).toEqual([
      "away",
      "still",
      "away",
      "still",
      "back",
    ]);
    expect(Arr.map(BUS, lengthOf)).toEqual([12, 0, 8, 0, 20]);
    expect(Arr.map(BUS, speedOf)).toEqual([48, 0, 24, 0, 40]);
  });

  it("totals the distance covered both ways over the whole time", () => {
    const totals = totalsOf(BUS);
    expect(totals.distance).toBe(40);
    expect(totals.minutes).toBe(90);
    expect(totals.speed).toBeCloseTo(80 / 3);
    expect(farthestOf(BUS)).toBe(20);
    expect(
      farthestOf(
        stagesOf({ depart: 0, from: 30, legs: [{ change: -30, minutes: 30 }] })
      )
    ).toBe(30);
  });
});

describe("which way a vehicle faces", () => {
  it("faces where it goes, and keeps facing that way at a stop on the way", () => {
    expect(facingAt(BUS, 5)).toBe(0);
    expect(facingAt(BUS, 20)).toBe(0);
    expect(facingAt(BUS, 70)).toBe(1);
  });

  it("turns round in the middle of a wait before it heads back", () => {
    expect(facingAt(BUS, 46)).toBe(0);
    expect(facingAt(BUS, 52.5)).toBeCloseTo(0.5);
    expect(facingAt(BUS, 59)).toBe(1);
  });

  it("faces its first move while it waits to leave, and its last once it arrives", () => {
    const waiting = stagesOf({
      depart: 0,
      from: 20,
      legs: [
        { change: 0, minutes: 10 },
        { change: -20, minutes: 20 },
        { change: 0, minutes: 5 },
      ],
    });
    expect(facingAt(waiting, -3)).toBe(1);
    expect(facingAt(waiting, 5)).toBe(1);
    expect(facingAt(waiting, 40)).toBe(1);
    const parked = stagesOf({
      depart: 0,
      from: 0,
      legs: [{ change: 0, minutes: 10 }],
    });
    expect(facingAt(parked, 5)).toBe(0);
  });
});
