import { describe, expect, it } from "@effect/vitest";
import {
  along,
  travel,
  wire,
  wirePath,
} from "@/components/marketing/school/flow/wire";

const TOP = { x: 50, y: 20 };
const LEFT = { x: 10, y: 80 };

describe("marketing/school/flow/wire", () => {
  it("bends a column wire halfway down, leaving and arriving upright", () => {
    expect(wire(TOP, LEFT, "column")).toEqual([
      TOP,
      { x: 50, y: 50 },
      { x: 10, y: 50 },
      LEFT,
    ]);
  });

  it("bends a row wire halfway across, leaving and arriving level", () => {
    expect(wire(LEFT, TOP, "row")).toEqual([
      LEFT,
      { x: 30, y: 80 },
      { x: 30, y: 20 },
      TOP,
    ]);
  });

  it("writes a wire as one curve of an SVG path", () => {
    expect(wirePath(wire(TOP, LEFT, "column"))).toBe(
      "M50,20 C50,50 10,50 10,80"
    );
  });

  it("starts at the wire's start, ends at its end, and passes its middle halfway", () => {
    const path = wire(TOP, LEFT, "column");
    expect(along(path, 0)).toEqual(TOP);
    expect(along(path, 1)).toEqual(LEFT);
    expect(along(path, 0.5)).toEqual({ x: 30, y: 50 });
  });

  it("travels a wire in pixels of the stage, from its start to its end", () => {
    const way = travel(wire(TOP, LEFT, "column"), { height: 400, width: 800 });
    expect(way.x).toHaveLength(13);
    expect(way.y).toHaveLength(13);
    expect([way.x[0], way.y[0]]).toEqual([400, 80]);
    expect([way.x[12], way.y[12]]).toEqual([80, 320]);
    expect([way.x[6], way.y[6]]).toEqual([240, 200]);
  });
});
