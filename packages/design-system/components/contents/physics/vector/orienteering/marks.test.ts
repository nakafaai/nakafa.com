import { describe, expect, it } from "@effect/vitest";
import {
  MarksSchema,
  markVector,
  shownVector,
} from "@repo/design-system/components/contents/physics/vector/orienteering/marks";
import { Schema } from "effect";

const marks = Schema.decodeUnknownSync(MarksSchema)({
  a: { east: 20, north: 10 },
  b: { east: 80, north: 90 },
  c: { east: 120, north: -20 },
});

describe("markVector", () => {
  it("runs 60 m east and 80 m north from A to B, 100 m at 53.13°", () => {
    const vector = markVector(marks.a, marks.b);
    expect(vector).toMatchObject({ east: 60, north: 80, size: 100 });
    expect(vector.angle).toBeCloseTo(53.13, 2);
  });

  it("has no direction from a place to itself", () => {
    expect(markVector(marks.a, marks.a).angle).toBe(0);
  });
});

describe("shownVector", () => {
  it("turns the vector around from B to A, at 233.13°", () => {
    const shown = shownVector(marks, "back");
    expect(shown.from).toBe(marks.b);
    expect(shown.vector).toMatchObject({ east: -60, north: -80, size: 100 });
    expect(shown.vector.angle).toBeCloseTo(233.13, 2);
  });

  it("draws the same vector from C as from A", () => {
    const copy = shownVector(marks, "copy");
    expect(copy.from).toBe(marks.c);
    expect(copy.vector).toEqual(shownVector(marks, "forward").vector);
  });

  it("starts the difference at A, where the positions of A and B meet it", () => {
    const difference = shownVector(marks, "difference");
    expect(difference.from).toBe(marks.a);
    expect(difference.vector.east).toBe(marks.b.east - marks.a.east);
  });
});
