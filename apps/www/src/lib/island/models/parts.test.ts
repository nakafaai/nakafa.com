// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr } from "effect";
import {
  boundsOf,
  box,
  flatten,
  loft,
  MODEL_STRIDE,
  meters,
  mirrored,
  normalOf,
  rgb,
  tipped,
  turned,
} from "@/lib/island/models/parts";

/** Whether every face of a solid points away from `inside`. */
function facesOut(
  faces: ReturnType<typeof box>,
  inside: readonly [number, number, number]
) {
  return Arr.every(faces, (face) => {
    const n = normalOf(face.corners);
    const center = Arr.reduce(face.corners, [0, 0, 0], (sum, corner) => [
      sum[0] + corner[0] / face.corners.length,
      sum[1] + corner[1] / face.corners.length,
      sum[2] + corner[2] / face.corners.length,
    ]);
    return (
      n[0] * (center[0] - inside[0]) +
        n[1] * (center[1] - inside[1]) +
        n[2] * (center[2] - inside[2]) >
      0
    );
  });
}

describe("island/models/parts", () => {
  it("builds boxes and lofts whose faces all point outward, mirrored or not", () => {
    const red = rgb(0xff_00_00);
    expect(red).toEqual([1, 0, 0]);
    const block = box([0, 0, 0], [2, 1, 3], red);
    expect(facesOut(block, [1, 0.5, 1.5])).toBe(true);
    expect(facesOut(mirrored(block), [-1, 0.5, 1.5])).toBe(true);
    const hull = loft(
      [
        { high: 1, low: 0, width: 0.5, z: 0 },
        { high: 1.5, low: -0.5, width: 1, z: 2 },
        { high: 1, low: 0, width: 0.4, z: 4 },
      ],
      red
    );
    expect(hull).toHaveLength(2 * 4 + 2);
    expect(facesOut(hull, [0, 0.5, 2])).toBe(true);
  });

  it("draws a box tapered to a point without its folded top, three corners a triangle", () => {
    const spire = flatten(box([0, 0, 0], [1, 1, 1], rgb(0x80_80_80), 1));
    expect(spire.length).toBe(5 * 2 * 3 * MODEL_STRIDE);
    expect(
      normalOf([
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
      ])
    ).toEqual([0, 0, 0]);
  });

  it("turns and tips parts around a pivot, and measures a model in blocks", () => {
    const [face] = turned(box([1, 0, 0], [2, 1, 1], rgb(0)), Math.PI / 2);
    expect(face.corners[0][0]).toBeCloseTo(0, 6);
    expect(face.corners[0][2]).toBeCloseTo(-1, 6);
    const tipTop = Arr.flatMap(
      tipped(box([0, 0, 0], [1, 2, 1], rgb(0)), Math.PI / 2),
      (part) => part.corners
    );
    expect(Math.max(...Arr.map(tipTop, (corner) => corner[2]))).toBeCloseTo(
      2,
      6
    );
    expect(meters(0.9)).toBeCloseTo(1, 6);
    expect(boundsOf(box([0, 0, 0], [2, 3, 4], rgb(0)))).toEqual({
      x: [0, 2],
      y: [0, 3],
      z: [0, 4],
    });
  });
});
