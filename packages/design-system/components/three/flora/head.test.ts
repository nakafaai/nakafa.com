import { describe, expect, it } from "@effect/vitest";
import { LEAF_STRIDE } from "@repo/design-system/components/three/flora/habit";
import type { Head } from "@repo/design-system/components/three/flora/head";
import { growHead } from "@repo/design-system/components/three/flora/head";
import { Array as Arr, Option } from "effect";

/** A flower head in full bloom. */
const HEAD: Head = { florets: 200, open: 1, radius: 0.1, rays: 13, seed: 2 };

/** The parts of a head as one record each. */
function partsOf(parts: readonly number[]) {
  return Arr.map(Arr.chunksOf(parts, LEAF_STRIDE), (part) => ({
    face: [Number(part[6]), Number(part[7]), Number(part[8])] as const,
    heading: [Number(part[3]), Number(part[4]), Number(part[5])] as const,
    place: [Number(part[0]), Number(part[1]), Number(part[2])] as const,
    size: Number(part[9]),
    tone: Number(part[10]),
  }));
}

describe("growHead", () => {
  it("rings the disc with its rays, each pointing out of the head on a square frame", () => {
    const rays = partsOf(growHead(HEAD).rays);

    expect(rays).toHaveLength(HEAD.rays);
    for (const ray of rays) {
      expect(Math.hypot(ray.place[0], ray.place[2])).toBeCloseTo(
        HEAD.radius * 0.92
      );
      expect(
        ray.heading[0] * ray.place[0] + ray.heading[2] * ray.place[2]
      ).toBeGreaterThan(0);
      expect(Math.hypot(...ray.heading)).toBeCloseTo(1);
      expect(
        ray.heading[0] * ray.face[0] +
          ray.heading[1] * ray.face[1] +
          ray.heading[2] * ray.face[2]
      ).toBeCloseTo(0);
    }
  });

  it("lays the rays flat in bloom and holds them upright in the bud", () => {
    const open = partsOf(growHead(HEAD).rays);
    const bud = partsOf(growHead({ ...HEAD, open: 0 }).rays);

    expect(open[0]?.heading[1]).toBeLessThan(0.3);
    expect(bud[0]?.heading[1]).toBeGreaterThan(0.9);
  });

  it("sets a bract behind every ray, turned down in bloom", () => {
    const bracts = partsOf(growHead(HEAD).bracts);

    expect(bracts).toHaveLength(HEAD.rays);
    expect(bracts[0]?.heading[1]).toBeLessThan(0);
    expect(bracts[0]?.size).toBeLessThan(HEAD.radius * 2);
  });

  it("packs the disc florets on a low dome, smaller and more open toward the rim", () => {
    const florets = partsOf(growHead(HEAD).florets);

    expect(florets).toHaveLength(HEAD.florets);
    for (const floret of florets) {
      expect(Math.hypot(floret.place[0], floret.place[2])).toBeLessThan(
        HEAD.radius
      );
      expect(floret.place[1]).toBeGreaterThanOrEqual(0);
      expect(Math.hypot(...floret.heading)).toBeCloseTo(1);
      expect(Math.hypot(...floret.face)).toBeCloseTo(1);
    }
    expect(florets[0]?.place[1]).toBeGreaterThan(
      Number(Option.getOrUndefined(Arr.last(florets))?.place[1])
    );
    expect(florets[0]?.size).toBeGreaterThan(
      Number(Option.getOrUndefined(Arr.last(florets))?.size)
    );
    expect(Option.getOrUndefined(Arr.last(florets))?.tone).toBeGreaterThan(
      Number(florets[0]?.tone)
    );
  });
});
