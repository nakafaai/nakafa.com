// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import {
  boundsOf,
  box,
  flatten,
  loft,
  MODEL_STRIDE,
  meters,
  mirrored,
  normalOf,
  type Rig,
  rgb,
  rigged,
  tipped,
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

  it("tips parts around a pivot, and measures a model in blocks", () => {
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

  it("bakes each corner's motion: a wave growing toward the tail, a stride from the hip with left and right apart, a flap from the root", () => {
    /** The motion numbers of every corner of flattened faces: swing, phase, rate, mode. */
    const motions = (faces: Parameters<typeof flatten>[0]) =>
      Arr.map(
        Arr.chunksOf(Arr.fromIterable(flatten(faces)), MODEL_STRIDE),
        (corner) => Arr.drop(corner, 9)
      );
    const swingsOf = (faces: Parameters<typeof flatten>[0]) =>
      Arr.map(motions(faces), ([swing]) => swing);
    const grey = rgb(0x80_80_80);
    const wave: Rig = {
      mode: "sway",
      phase: 0,
      pivot: 0,
      rate: 6,
      reach: 0.1,
      waves: 1,
    };
    // Two blocks long: a fifth of the reach at the head, all of it at the tail.
    const body = rigged(box([0, 0, -1], [0.2, 0.2, 1], grey), wave);
    expect(Math.max(...swingsOf(body))).toBeCloseTo(0.2);
    expect(Math.min(...swingsOf(body))).toBeCloseTo(0.04);
    expect(
      Arr.every(motions(body), ([, , rate, mode]) => rate === 6 && mode === 1)
    ).toBe(true);
    const leg = rigged(box([0.1, 0, 0], [0.2, 1, 0.1], grey), {
      mode: "stride",
      phase: 0,
      pivot: 1,
      rate: 8,
      reach: 0.5,
      waves: 0,
    });
    expect(Math.max(...swingsOf(leg))).toBeCloseTo(0.5);
    expect(motions(leg)[0][1]).toBe(0);
    expect(motions(mirrored(leg))[0][1]).toBeCloseTo(Math.PI);
    const wing = rigged(box([0.5, 0, 0], [1.5, 0.05, 0.2], grey), {
      mode: "flap",
      phase: 0,
      pivot: 0.5,
      rate: 3,
      reach: 0.4,
      waves: 0,
    });
    expect(Math.max(...swingsOf(wing))).toBeCloseTo(0.4);
    // A stalk leans in the current more the higher up it, the sway climbing it as a wave.
    const stalk = rigged(box([0, 0, 0], [0.1, 3, 0.1], grey), {
      mode: "lean",
      phase: 0,
      pivot: 1,
      rate: 1.1,
      reach: 0.1,
      waves: 0.25,
    });
    expect(Math.max(...swingsOf(stalk))).toBeCloseTo(0.2);
    expect(Math.min(...swingsOf(stalk))).toBe(0);
    const [, phase, , mode] = Option.getOrElse(
      Arr.findFirst(motions(stalk), ([swing]) => swing > 0.19),
      () => []
    );
    expect(phase).toBeCloseTo(Math.PI);
    expect(mode).toBe(6);
    // A part with no length along the body has nothing to wave along, and a part with no rig stays still.
    const plaque = rigged(box([0, 0, 0], [1, 1, 0], grey), wave);
    expect(Arr.every(swingsOf(plaque), (swing) => swing === 0)).toBe(true);
    expect(motions(box([0, 0, 0], [1, 1, 1], grey))[0]).toEqual([0, 0, 0, 0]);
  });
});
