import {
  hasTwoPoints,
  readCoordinateArtifactGeometry,
  readExactInputPoints,
} from "@repo/math/artifact/geometry";
import { describe, expect, it } from "vitest";

describe("coordinate artifact geometry", () => {
  it("derives full line primitives for line operations", () => {
    const points = readExactInputPoints([
      { x: "0", y: "0" },
      { x: "3", y: "2" },
    ]);

    if (!hasTwoPoints(points)) {
      expect.fail("Expected two exact points.");
    }

    const geometry = readCoordinateArtifactGeometry("line", points);

    expect(geometry.primitives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "line", label: "Verified line" }),
      ])
    );
  });

  it("keeps distance-like relationships as bounded segments", () => {
    const points = readExactInputPoints([
      { x: "0", y: "0" },
      { x: "3", y: "2" },
    ]);

    if (!hasTwoPoints(points)) {
      expect.fail("Expected two exact points.");
    }

    const geometry = readCoordinateArtifactGeometry("distance", points);

    expect(geometry.primitives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "segment", label: "Segment" }),
      ])
    );
  });

  it("derives circle relationships as bounded parametric curves", () => {
    const points = readExactInputPoints([
      { x: "0", y: "0" },
      { x: "3", y: "0" },
    ]);

    if (!hasTwoPoints(points)) {
      expect.fail("Expected two exact points.");
    }

    const geometry = readCoordinateArtifactGeometry("circle", points);

    expect(geometry.primitives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "parametric-curve",
          label: "Verified circle",
        }),
      ])
    );
  });
});
