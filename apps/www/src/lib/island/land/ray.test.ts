// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Option } from "effect";
import { depthAt, heightAt, landOf, surfaceAt } from "@/lib/island/land/ground";
import { homeOf } from "@/lib/island/land/home";
import { landHit } from "@/lib/island/land/ray";

const SEED = 4242;

/** The lattice point every world of the seed opens on. */
const [HOME_X, HOME_Z] = homeOf(SEED);

/** Lattice points on rings about the seed's home, the nearest first. */
const AROUND = Arr.flatMap(Arr.range(0, 30), (ring) =>
  Arr.makeBy(Math.max(1, ring * 6), (slot) => {
    const turn = (slot / Math.max(1, ring * 6)) * Math.PI * 2;
    return [
      HOME_X + Math.round(Math.cos(turn) * ring * 4),
      HOME_Z + Math.round(Math.sin(turn) * ring * 4),
    ] as const;
  })
);

/** The nearest place to the seed's home that a test asks for. */
function placeWhere(test: (x: number, z: number) => boolean) {
  return Option.getOrThrow(Arr.findFirst(AROUND, ([x, z]) => test(x, z)));
}

/** A direction of length one from one point toward another. */
function toward(
  from: readonly [number, number, number],
  to: readonly [number, number, number]
) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  return [
    (to[0] - from[0]) / length,
    (to[1] - from[1]) / length,
    (to[2] - from[2]) / length,
  ] as const;
}

describe("island/land/ray", () => {
  it("meets the ground under a ray from straight above where the land says it lies", () => {
    const land = landOf(SEED);
    const dry = Arr.filter(
      Arr.take(AROUND, 120),
      ([x, z]) => depthAt(land, x + 0.3, z - 0.4) < -0.05
    );
    expect(dry.length).toBeGreaterThan(20);
    for (const [x, z] of dry) {
      const hit = Option.getOrThrow(
        landHit(land, [x + 0.3, 140, z - 0.4], [0, -1, 0])
      );
      expect(hit.x).toBe(x + 0.3);
      expect(hit.z).toBe(z - 0.4);
      expect(Math.abs(hit.y - heightAt(land, x + 0.3, z - 0.4))).toBeLessThan(
        0.02
      );
      expect(hit.water).toBe(false);
    }
  });

  it("meets the water's face where water stands over the ground, and says so", () => {
    const land = landOf(SEED);
    const [x, z] = placeWhere((i, j) => depthAt(land, i, j) > 1);
    const hit = Option.getOrThrow(landHit(land, [x, 60, z], [0, -1, 0]));
    expect(Math.abs(hit.y - surfaceAt(land, x, z))).toBeLessThan(0.02);
    expect(hit.y).toBeGreaterThan(heightAt(land, x, z) + 0.9);
    expect(hit.water).toBe(true);
  });

  it("meets what a slanted ray strikes first, with no ground in its way before that", () => {
    const land = landOf(SEED);
    const aim = [HOME_X, heightAt(land, HOME_X, HOME_Z), HOME_Z] as const;
    const eye = [aim[0] - 40, aim[1] + 30, aim[2] + 25] as const;
    const direction = toward(eye, aim);
    const hit = Option.getOrThrow(landHit(land, eye, direction));
    const reach = Math.hypot(hit.x - eye[0], hit.y - eye[1], hit.z - eye[2]);
    expect(hit.x).toBeCloseTo(eye[0] + direction[0] * reach, 6);
    expect(hit.z).toBeCloseTo(eye[2] + direction[2] * reach, 6);
    expect(
      Math.abs(
        hit.y -
          Math.max(heightAt(land, hit.x, hit.z), surfaceAt(land, hit.x, hit.z))
      )
    ).toBeLessThan(0.02);
    // Nothing the ray passed on its way stands as high as the ray did there.
    for (const part of Arr.range(1, 199)) {
      const along = (reach * part) / 200;
      const x = eye[0] + direction[0] * along;
      const z = eye[2] + direction[2] * along;
      expect(eye[1] + direction[1] * along).toBeGreaterThan(
        Math.max(heightAt(land, x, z), surfaceAt(land, x, z)) - 0.02
      );
    }
    // The ray was aimed at a point of the ground, so it meets the land there or sooner.
    expect(reach).toBeLessThanOrEqual(Math.hypot(40, 30, 25) + 0.05);
  });

  it("meets nothing where a ray leaves the land for the sky", () => {
    const land = landOf(SEED);
    expect(landHit(land, [HOME_X, 60, HOME_Z], [0, 1, 0])).toEqual(
      Option.none()
    );
    expect(landHit(land, [HOME_X, 60, HOME_Z], [0.6, 0.8, 0])).toEqual(
      Option.none()
    );
  });
});
