import { describe, expect, it } from "@effect/vitest";
import { sightOver } from "@repo/design-system/components/contents/physics/kinematics/sight";

/** A square frame with a right angle of view, filled to its edges: it sees as far to a side as it stands away. */
const SQUARE = { fill: 1, fov: 90, shape: 1 } as const;

describe("sightOver", () => {
  it("stands as far back as the subject is wide in a frame with a right angle of view", () => {
    const sight = sightOver(
      [
        [-4, 0, 0],
        [4, 0, 0],
      ],
      [0, 0, -1],
      SQUARE
    );

    expect(sight.position[0]).toBeCloseTo(0, 9);
    expect(sight.position[1]).toBeCloseTo(0, 9);
    expect(sight.position[2]).toBeCloseTo(4, 9);
    expect(sight.target[2]).toBeCloseTo(0, 9);
  });

  it("steps back by as much as a frame is narrower", () => {
    const sight = sightOver(
      [
        [-4, 0, 0],
        [4, 0, 0],
      ],
      [0, 0, -1],
      { ...SQUARE, shape: 0.5 }
    );

    expect(sight.position[2]).toBeCloseTo(8, 9);
  });

  it("is bound by the frame's height when the subject is tall", () => {
    const sight = sightOver(
      [
        [0, -3, 0],
        [0, 3, 0],
      ],
      [0, 0, -1],
      { ...SQUARE, shape: 2 }
    );

    expect(sight.position[2]).toBeCloseTo(3, 9);
  });

  it("leaves the margin it is asked for around the subject", () => {
    const sight = sightOver(
      [
        [-4, 0, 0],
        [4, 0, 0],
      ],
      [0, 0, -1],
      { ...SQUARE, fill: 0.8 }
    );

    expect(sight.position[2]).toBeCloseTo(5, 9);
  });

  it("holds every point of an uneven subject up to the margin when it looks down from a side", () => {
    const points = [
      [0, 0, 30],
      [45, 0, -30],
      [-3, 2, 34],
      [48, 2, -36],
    ] as const;
    const frame = { fill: 0.9, fov: 40, shape: 1.42 } as const;
    const { position, target } = sightOver(points, [20, -30, -60], frame);
    const look = [
      target[0] - position[0],
      target[1] - position[1],
      target[2] - position[2],
    ] as const;
    const far = Math.hypot(look[0], look[1], look[2]);
    const tall = Math.tan((frame.fov * Math.PI) / 360);
    const shares = points.map((point) => {
      const from = [
        point[0] - position[0],
        point[1] - position[1],
        point[2] - position[2],
      ] as const;
      const deep =
        (from[0] * look[0] + from[1] * look[1] + from[2] * look[2]) / far;
      const level = Math.hypot(look[0], look[2]);
      const side = (from[0] * -look[2] + from[2] * look[0]) / level;
      const rise = Math.sqrt(
        Math.max(
          0,
          from[0] ** 2 + from[1] ** 2 + from[2] ** 2 - deep ** 2 - side ** 2
        )
      );
      return [
        side / (deep * tall * frame.shape),
        rise / (deep * tall),
      ] as const;
    });
    const widest = Math.max(...shares.map(([side]) => Math.abs(side)));
    const tallest = Math.max(...shares.map(([, rise]) => rise));

    expect(position[1]).toBeGreaterThan(0);
    expect(widest).toBeLessThanOrEqual(0.9 + 1e-9);
    expect(tallest).toBeLessThanOrEqual(0.9 + 1e-9);
    expect(Math.max(widest, tallest)).toBeCloseTo(0.9, 6);
  });
});
