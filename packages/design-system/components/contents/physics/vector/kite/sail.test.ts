import { describe, expect, it } from "@effect/vitest";
import {
  KITE,
  sailGeometry,
  tailGeometry,
} from "@repo/design-system/components/contents/physics/vector/kite/sail";
import { Array as Arr } from "effect";

describe("sailGeometry", () => {
  it("sews two colours from four bellied triangles that stay flat along the frame", () => {
    const sail = sailGeometry();
    const position = sail.getAttribute("position");
    const depths = Arr.makeBy(position.count, (index) => position.getZ(index));

    expect(position.count).toBe(4 * 66);
    expect(sail.groups[0]?.count).toBe(sail.groups[1]?.count);
    expect(Math.max(...depths)).toBeCloseTo(0, 6);
    expect(Math.min(...depths)).toBeCloseTo(
      (-KITE.billow * 27 * (4 / 1000) * 6 * 6) / 6,
      1
    );
  });

  it("reaches from the nose to the tail and across the spreader", () => {
    const sail = sailGeometry();
    sail.computeBoundingBox();

    expect(sail.boundingBox?.max.y).toBeCloseTo(KITE.spine * KITE.cross, 6);
    expect(sail.boundingBox?.min.y).toBeCloseTo(
      -KITE.spine * (1 - KITE.cross),
      6
    );
    expect(sail.boundingBox?.max.x).toBeCloseTo(KITE.spreader / 2, 6);
  });
});

describe("tailGeometry", () => {
  it("streams a ribbon down and back from the kite's tail", () => {
    const tail = tailGeometry(8, 0.14, 4);
    tail.computeBoundingBox();

    expect(tail.getAttribute("position").count).toBe(122);
    expect(tail.boundingBox?.min.y).toBeCloseTo(-8, 6);
    expect(tail.boundingBox?.min.z).toBeLessThan(-2);
  });
});
