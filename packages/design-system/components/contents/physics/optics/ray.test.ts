import { describe, expect, it } from "@effect/vitest";
import {
  apparentDepth,
  blockPath,
  criticalAngle,
  lensReach,
  principalRays,
  refract,
  starRay,
  telescope,
  thinLens,
  traceBlock,
  traceLayers,
} from "@repo/design-system/components/contents/physics/optics/ray";
import { Array as Arr, Option } from "effect";

describe("refract", () => {
  it("bends a 60 degree ray in air to 35.3 degrees in glass of index 1.50", () => {
    expect(Option.getOrThrow(refract(1, 1.5, 60))).toBeCloseTo(35.26, 2);
  });

  it("reflects a ray from glass that meets the surface beyond the critical angle", () => {
    expect(Option.isNone(refract(1.5, 1, 54.7))).toBe(true);
    expect(criticalAngle(1.5)).toBeCloseTo(41.81, 2);
  });
});

describe("traceBlock", () => {
  const block = { height: 1, index: 1.5, width: 1.6 };

  it("totally reflects the SPM ray at the side face, then lets it out through the bottom", () => {
    const { hits, refraction } = traceBlock(block, 1, 60);
    expect(refraction).toBeCloseTo(35.26, 2);
    expect(hits[0]).toMatchObject({ event: "reflected", face: "right" });
    expect(hits[0]?.incidence).toBeCloseTo(54.74, 2);
    expect(hits[1]).toMatchObject({ event: "refracted", face: "bottom" });
    expect(hits[1]?.incidence).toBeCloseTo(35.26, 2);
  });

  it("lets a ray at normal incidence straight down through the bottom", () => {
    const { hits } = traceBlock(block, 1, 0);
    expect(hits).toEqual([
      { at: { x: 1, y: 0 }, event: "refracted", face: "bottom", incidence: 0 },
    ]);
  });

  it("bounces a ray between both side faces of a tall narrow block until four faces", () => {
    const { hits } = traceBlock(
      { height: 20, index: 1.5, width: 0.2 },
      0.1,
      60
    );
    expect(Arr.map(hits, (hit) => hit.face)).toEqual([
      "right",
      "left",
      "right",
      "left",
    ]);
    expect(Arr.every(hits, (hit) => hit.event === "reflected")).toBe(true);
  });
});

describe("blockPath", () => {
  const block = { height: 1, index: 1.5, width: 1.6 };

  it("leaves the bottom face parallel to the ray that entered the top", () => {
    const { mirror, path } = blockPath(block, 1, 30, 2);
    const [source, entry, bottom, end] = path;
    expect(path).toHaveLength(4);
    expect(entry).toEqual({ x: 1, y: 1 });
    expect(source?.x).toBeCloseTo(0, 9);
    expect(source?.y).toBeCloseTo(1 + Math.sqrt(3), 9);
    expect(mirror.x).toBeCloseTo(2, 9);
    expect(mirror.y).toBeCloseTo(1 + Math.sqrt(3), 9);
    expect((end?.x ?? 0) - (bottom?.x ?? 0)).toBeCloseTo(1, 9);
    expect((end?.y ?? 0) - (bottom?.y ?? 0)).toBeCloseTo(-Math.sqrt(3), 9);
  });

  it("follows the SPM ray off the side face and out through the bottom", () => {
    const { hits, path, refraction } = blockPath(block, 1, 60, 1);
    expect(refraction).toBeCloseTo(35.26, 2);
    expect(Arr.map(hits, (hit) => hit.face)).toEqual(["right", "bottom"]);
    expect(path).toHaveLength(5);
    expect(path[2]?.x).toBe(1.6);
    expect(path[3]?.y).toBe(0);
    expect((path[4]?.x ?? 0) - (path[3]?.x ?? 0)).toBeCloseTo(
      -Math.sin(Math.PI / 3),
      9
    );
  });

  it("ends inside the glass when the ray never gets out", () => {
    const { path } = blockPath(
      { height: 20, index: 1.5, width: 0.2 },
      0.1,
      60,
      1
    );
    expect(path).toHaveLength(6);
  });
});

describe("apparentDepth", () => {
  it("lifts the coin's image from 3.0 to 5.0 cm above the bottom when 6.0 cm of oil is poured on", () => {
    const water = { index: 4 / 3, thickness: 12 };
    const before = apparentDepth([water]);
    expect(before.apparent).toBeCloseTo(9, 9);
    expect(before.image).toBeCloseTo(3, 9);
    const after = apparentDepth([{ index: 1.5, thickness: 6 }, water]);
    expect(after.apparent).toBeCloseTo(13, 9);
    expect(after.image).toBeCloseTo(5, 9);
    expect(after.real).toBe(18);
  });
});

describe("traceLayers", () => {
  it("bends a ray away from the normal at each boundary on its way up", () => {
    const { crossings, emerges } = traceLayers(
      [
        { index: 1.5, thickness: 6 },
        { index: 4 / 3, thickness: 12 },
      ],
      5
    );
    expect(crossings).toHaveLength(3);
    expect(crossings[1]?.y).toBe(12);
    expect(crossings[2]?.y).toBe(18);
    expect(emerges).toBeCloseTo(
      Math.asin((4 / 3) * Math.sin(Math.PI / 36)) * (180 / Math.PI),
      9
    );
  });
});

describe("thinLens", () => {
  it("forms a virtual upright image three times as tall from 10 cm in front of a 15 cm lens", () => {
    const image = Option.getOrThrow(thinLens(15, 10));
    expect(image.distance).toBeCloseTo(-30, 9);
    expect(image.magnification).toBeCloseTo(3, 9);
    expect(image.real).toBe(false);
  });

  it("forms a real inverted image three times as tall from 20 cm in front", () => {
    const image = Option.getOrThrow(thinLens(15, 20));
    expect(image.distance).toBeCloseTo(60, 9);
    expect(image.magnification).toBeCloseTo(-3, 9);
    expect(image.real).toBe(true);
  });

  it("forms no image of an object at the focal point", () => {
    expect(Option.isNone(thinLens(15, 15))).toBe(true);
  });
});

describe("lensReach", () => {
  const farthest = { left: 63, right: 64.5 };

  it("reaches the 2F mark on each side when the object and its real image stand there", () => {
    expect(lensReach(15, 30, farthest)).toEqual({ left: 30, right: 30 });
  });

  it("reaches back to a virtual image behind the object", () => {
    const reach = lensReach(15, 10, farthest);
    expect(reach.left).toBeCloseTo(30, 9);
    expect(reach.right).toBe(30);
  });

  it("reaches out to a far object and stops at the end of the bench for an image beyond it", () => {
    expect(lensReach(15, 60, farthest).left).toBe(60);
    expect(lensReach(15, 18, farthest).right).toBe(64.5);
    expect(lensReach(15, 14, farthest).left).toBe(63);
  });

  it("keeps to the 2F marks when the object at the focal point has no image", () => {
    expect(lensReach(15, 15, farthest)).toEqual({ left: 30, right: 30 });
  });
});

describe("telescope", () => {
  it("spaces lenses of +1.0 D and +20 D 105 cm apart and magnifies 20 times", () => {
    expect(telescope(1, 20)).toEqual({
      eyepiece: 5,
      length: 105,
      magnification: 20,
      objective: 100,
    });
  });
});

describe("principalRays", () => {
  it("sends all three rays from the tip through the tip of the real image", () => {
    const image = Option.getOrThrow(thinLens(15, 20));
    const rays = principalRays(15, 20, 2);

    expect(rays).toHaveLength(3);
    for (const ray of rays) {
      expect(ray.height + ray.slope * image.distance).toBeCloseTo(
        2 * image.magnification,
        10
      );
    }
  });

  it("makes the rays of a near object seem to come from the tip of the virtual image", () => {
    const image = Option.getOrThrow(thinLens(15, 10));
    const rays = principalRays(15, 10, 2);

    expect(Arr.map(rays, (ray) => ray.height)).toStrictEqual([2, 0, 6]);
    for (const ray of rays) {
      expect(ray.height + ray.slope * image.distance).toBeCloseTo(
        2 * image.magnification,
        10
      );
    }
  });

  it("has no ray through the near focal point when the object stands there", () => {
    expect(principalRays(15, 15, 2)).toHaveLength(2);
  });
});

describe("starRay", () => {
  it("brings every ray from the star to one point of the focal plane and out at one steeper slope", () => {
    const lenses = { eyepiece: 5, objective: 100 };
    const tilt = Math.tan((1.2 * Math.PI) / 180);
    const high = starRay(4.8, tilt, lenses);
    const low = starRay(-4.8, tilt, lenses);

    expect(high.image).toBeCloseTo(100 * tilt, 10);
    expect(low.image).toBeCloseTo(high.image, 10);
    expect(high.out).toBeCloseTo(-20 * tilt, 10);
    expect(low.out).toBeCloseTo(high.out, 10);
    expect(high.atEyepiece).toBeCloseTo(100 * tilt + (tilt - 0.048) * 5, 10);
  });
});
