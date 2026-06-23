import { findPolygonGeometryIssue } from "@repo/math/schema/coordinate/polygon";
import { describe, expect, it } from "vitest";

describe("coordinate polygon geometry validation", () => {
  it("rejects duplicate polygon vertices", () => {
    expect(
      findPolygonGeometryIssue("polygon-duplicate", [
        point(0, 0, 0),
        point(1, 0, 0),
        point(0, 0, 0),
      ])
    ).toBe(
      "Coordinate primitive polygon-duplicate polygon vertex 3 must not duplicate vertex 1."
    );
  });

  it("rejects zero-area polygon primitives", () => {
    expect(
      findPolygonGeometryIssue("polygon-collinear", [
        point(0, 0, 0),
        point(1, 1, 1),
        point(2, 2, 2),
      ])
    ).toBe(
      "Coordinate primitive polygon-collinear polygon vertices must enclose nonzero area."
    );
  });

  it("rejects overflowed polygon area calculations", () => {
    expect(
      findPolygonGeometryIssue("polygon-overflow", [
        point(0, 0, 0),
        point(1e308, 1e308, 0),
        point(5e307, 5e307, 0),
      ])
    ).toBe(
      "Coordinate primitive polygon-overflow polygon area calculation must stay finite."
    );
  });

  it("rejects non-coplanar polygon vertices", () => {
    expect(
      findPolygonGeometryIssue("polygon-nonplanar", [
        point(0, 0, 0),
        point(1, 0, 0),
        point(0, 1, 0),
        point(0, 0, 1),
      ])
    ).toBe(
      "Coordinate primitive polygon-nonplanar polygon vertices must be coplanar."
    );
  });

  it("rejects unsafe polygon planarity calculations", () => {
    expect(
      findPolygonGeometryIssue("polygon-dot-overflow", [
        point(0, 0, 0),
        point(1e154, 0, 0),
        point(0, 1e154, 0),
        point(0, 0, 2),
      ])
    ).toBe(
      "Coordinate primitive polygon-dot-overflow polygon planarity calculation must stay finite."
    );

    expect(
      findPolygonGeometryIssue("polygon-dot-rounded", [
        point(0, 0, 0),
        point(0, 0, 1),
        point(1, -1e20, 0),
        point(1, 1, 0),
      ])
    ).toBe(
      "Coordinate primitive polygon-dot-rounded polygon planarity calculation must stay finite."
    );
  });

  it("defensively rejects empty polygon geometry", () => {
    expect(findPolygonGeometryIssue("polygon-empty", [])).toBe(
      "Coordinate primitive polygon-empty polygon vertices must enclose nonzero area."
    );
  });

  it("accepts non-collinear coplanar polygon primitives", () => {
    expect(
      findPolygonGeometryIssue("polygon-area", [
        point(0, 0, 0),
        point(1, 0, 0),
        point(0, 1, 0),
        point(1, 1, 0),
      ])
    ).toBeUndefined();
  });
});

function point(x: number, y: number, z: number) {
  return { x, y, z };
}
