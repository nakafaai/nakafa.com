import {
  bend,
  bounce,
  converge,
} from "@repo/design-system/components/three/optic/trace";
import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";

const DEGREE = Math.PI / 180;

/** A unit direction leaning `degrees` from straight down, toward the right. */
function down(degrees: number): [number, number] {
  return [Math.sin(degrees * DEGREE), -Math.cos(degrees * DEGREE)];
}

describe("bend", () => {
  it("bends a ray toward the normal by Snell's law as it enters glass", () => {
    const bent = Option.getOrThrow(bend(down(60), [0, 1], 1, 1.5));
    const refraction = Math.atan2(bent[0], -bent[1]) / DEGREE;

    expect(refraction).toBeCloseTo(35.264, 3);
    expect(Math.hypot(bent[0], bent[1])).toBeCloseTo(1, 12);
  });

  it("gives the same ray whichever side of the boundary the normal points to", () => {
    const facing = Option.getOrThrow(bend(down(40), [0, 1], 1, 1.33));
    const away = Option.getOrThrow(bend(down(40), [0, -1], 1, 1.33));

    expect(away[0]).toBeCloseTo(facing[0], 12);
    expect(away[1]).toBeCloseTo(facing[1], 12);
  });

  it("lets a ray leave glass below the critical angle and bends it away from the normal", () => {
    const bent = Option.getOrThrow(bend(down(30), [0, 1], 1.5, 1));

    expect(Math.atan2(bent[0], -bent[1]) / DEGREE).toBeCloseTo(48.59, 2);
  });

  it("finds no refracted ray past the critical angle", () => {
    expect(Option.isNone(bend(down(45), [0, 1], 1.5, 1))).toBe(true);
  });
});

describe("bounce", () => {
  it("turns a ray about the normal so both angles are equal", () => {
    const [x, y] = bounce(down(25), [0, 1]);

    expect(x).toBeCloseTo(Math.sin(25 * DEGREE), 12);
    expect(y).toBeCloseTo(Math.cos(25 * DEGREE), 12);
  });
});

describe("converge", () => {
  it("sends a ray parallel to the axis through the far focal point", () => {
    const slope = converge(2, 0, 10);

    expect(2 + slope * 10).toBeCloseTo(0, 12);
  });

  it("leaves a ray through the centre of the lens undeviated", () => {
    expect(converge(0, 0.3, 10)).toBe(0.3);
  });

  it("agrees with the thin lens equation for an object beyond the focal point", () => {
    const object = 30;
    const focal = 10;
    const tip = 1;
    const viaCentre = -tip / object;
    const viaParallel = converge(tip, 0, focal);
    const image = tip / (viaCentre - viaParallel);

    expect(image).toBeCloseTo(1 / (1 / focal - 1 / object), 12);
  });
});
