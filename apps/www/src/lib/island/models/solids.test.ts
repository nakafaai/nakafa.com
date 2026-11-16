// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, HashMap, Option } from "effect";
import { type Face, normalOf, type Vec } from "@/lib/island/models/parts";
import {
  ball,
  moved,
  rod,
  type Spot,
  scaled,
  slab,
  tint,
  tube,
} from "@/lib/island/models/solids";

const RED = tint("roof", 2);

const BLUE = tint("sky", 2);
const GREEN = tint("grass", 2);

/** A point as text, to compare corners shared by neighbouring faces. */
const pointKey = (point: Vec) =>
  Arr.join(
    Arr.map(point, (value) => value.toFixed(5)),
    ","
  );

/** Every edge of a closed solid is walked once each way, by the two faces that share it. */
function isClosed(faces: readonly Face[]) {
  const edges = Arr.flatMap(faces, (face) =>
    Arr.map(face.corners, (corner, index) => {
      const next = face.corners[(index + 1) % face.corners.length];
      return {
        backward: `${pointKey(next)}>${pointKey(corner)}`,
        forward: `${pointKey(corner)}>${pointKey(next)}`,
      };
    })
  );
  const counts = Arr.reduce(
    edges,
    HashMap.empty<string, number>(),
    (map, { forward }) =>
      HashMap.set(
        map,
        forward,
        Option.getOrElse(HashMap.get(map, forward), () => 0) + 1
      )
  );
  const countOf = (key: string) =>
    Option.getOrElse(HashMap.get(counts, key), () => 0);
  return Arr.every(
    edges,
    ({ backward, forward }) => countOf(forward) === 1 && countOf(backward) === 1
  );
}

/** Every face of a convex solid points away from its middle. */
function pointsOut(faces: readonly Face[]) {
  const corners = Arr.flatMap(faces, (face) => face.corners);
  const origin: Vec = [0, 0, 0];
  const sum = Arr.reduce(
    corners,
    origin,
    (total, c): Vec => [total[0] + c[0], total[1] + c[1], total[2] + c[2]]
  );
  const [mx, my, mz] = [
    sum[0] / corners.length,
    sum[1] / corners.length,
    sum[2] / corners.length,
  ];
  return Arr.every(faces, (face) => {
    const [nx, ny, nz] = normalOf(face.corners);
    const [cx, cy, cz] = face.corners[0];
    return (
      nx * (cx - mx) + ny * (cy - my) + nz * (cz - mz) > -1e-9 &&
      Math.hypot(nx, ny, nz) > 0.5
    );
  });
}

describe("island/models/solids", () => {
  it("closes a tube with caps or tips, every face pointing out, the top face flat and lit as up", () => {
    const capped = tube(
      [
        { at: [0, 0, 0], high: 1, wide: 1 },
        { at: [0, 0, 2], high: 1, wide: 1 },
      ],
      (spot: Spot) => {
        if (spot.up > 0.99) {
          return BLUE;
        }
        return spot.up < -0.99 ? GREEN : RED;
      },
      6
    );
    expect(capped).toHaveLength(8);
    expect(isClosed(capped)).toBe(true);
    expect(pointsOut(capped)).toBe(true);
    const facing = (color: Face["color"]) =>
      Arr.map(
        Arr.filter(capped, (face) => face.color === color),
        (face) =>
          Arr.map(
            normalOf(face.corners),
            (value) => Math.round(value * 1e6) / 1e6 + 0
          )
      );
    expect(facing(BLUE)).toEqual([[0, 1, 0]]);
    expect(facing(GREEN)).toEqual([[0, -1, 0]]);
    const tipped = tube(
      [
        { at: [0, 0, 0], high: 0, wide: 0 },
        { at: [0, 0, 1], high: 1, wide: 2 },
        { at: [0, 0, 2], high: 0, wide: 0 },
      ],
      RED,
      5
    );
    expect(tipped).toHaveLength(10);
    expect(isClosed(tipped)).toBe(true);
    expect(pointsOut(tipped)).toBe(true);
  });

  it("runs a tube up and down as well as across, so legs and stems close the same way", () => {
    const leg = rod([0, 2, 0], [0, 0, 0], [0.3, 0.2], RED);
    const stem = rod([0, 0, 0], [0.5, 2, 0], [0.2, 0], RED);
    expect(isClosed(leg) && pointsOut(leg)).toBe(true);
    expect(isClosed(stem) && pointsOut(stem)).toBe(true);
    expect(stem).toHaveLength(5);
  });

  it("rounds a ball within its radii, closed from tip to tip", () => {
    const round = ball([1, 2, 3], [1, 2, 3], RED, 3, 8);
    const corners = Arr.flatMap(round, (face) => face.corners);
    expect(isClosed(round) && pointsOut(round)).toBe(true);
    expect(
      Arr.every(
        corners,
        ([x, y, z]) =>
          ((x - 1) / 1) ** 2 + ((y - 2) / 2) ** 2 + ((z - 3) / 3) ** 2 <=
          1 + 1e-9
      )
    ).toBe(true);
    expect(Math.min(...Arr.map(corners, (corner) => corner[2]))).toBeCloseTo(0);
  });

  it("gives a slab its thickness on both sides of its plane and closes its rim", () => {
    const fin = slab(
      [
        [0, 0, 0],
        [1, 0, 0],
        [1, 1, 0],
        [0, 1, 0],
      ],
      0.2,
      RED
    );
    expect(fin).toHaveLength(6);
    expect(isClosed(fin) && pointsOut(fin)).toBe(true);
    const depths = Arr.map(
      Arr.flatMap(fin, (face) => face.corners),
      (corner) => corner[2]
    );
    expect([Math.min(...depths), Math.max(...depths)]).toEqual([-0.1, 0.1]);
  });

  it("grows and moves faces without turning them", () => {
    const fin = slab(
      [
        [0, 0, 0],
        [1, 0, 0],
        [0, 1, 0],
      ],
      0.1,
      RED
    );
    expect(moved(scaled(fin, 2), [1, 0, 0])[0].corners[0]).toEqual([1, 0, 0.1]);
    expect(normalOf(scaled(fin, 3)[0].corners)).toEqual(
      normalOf(fin[0].corners)
    );
    expect(tint("roof", 0)).toEqual([0x7a / 255, 0x28 / 255, 0x28 / 255]);
  });
});
