import { describe, expect, it } from "@effect/vitest";
import {
  AXIS,
  ENGRAVING_DROP,
  engraving,
  frontRadius,
  hubPlace,
  knobProfile,
  MOUNTING,
  numericalAperture,
  objectiveLength,
  objectiveProfile,
  PARFOCAL,
  ringBand,
  SLIDE,
  STAGE,
  smearOutline,
  softened,
  workingDistance,
} from "@repo/design-system/components/contents/biology/microscope/form";
import { Array as Arr, Option } from "effect";

describe("objectives", () => {
  it("come closer to the specimen and grow longer as they magnify more", () => {
    expect(workingDistance(4)).toBeCloseTo(0.0186, 3);
    expect(workingDistance(40)).toBeLessThan(0.001);
    expect(objectiveLength(40)).toBeGreaterThan(objectiveLength(10));
    expect(objectiveLength(10)).toBeGreaterThan(objectiveLength(4));
    expect(frontRadius(40)).toBeLessThan(frontRadius(4));
  });

  it("share one focus: length and working distance add up to the parfocal distance", () => {
    for (const power of [4, 10, 40, 100]) {
      expect(objectiveLength(power) + workingDistance(power)).toBeCloseTo(
        PARFOCAL
      );
    }
  });

  it("are turned from the shoulder down to a front lens mount on the axis", () => {
    const rings = objectiveProfile(40);
    const heights = Arr.map(rings, ([, height]) => height);

    expect(rings[0]).toEqual([0, 0.004]);
    expect(Option.getOrThrow(Arr.last(rings))).toEqual([
      0,
      -objectiveLength(40),
    ]);
    expect(Math.min(...heights)).toBeCloseTo(-objectiveLength(40));
    expect(Math.min(...Arr.map(rings, ([radius]) => radius))).toBe(0);
  });

  it("carry the colour ring on the barrel", () => {
    const band = ringBand(10);

    expect(band.y).toBeLessThan(0);
    expect(band.y - band.height / 2).toBeGreaterThan(-objectiveLength(10));
    expect(band.radius).toBeGreaterThan(0.0116);
  });
});

describe("engraving", () => {
  it("gathers a wider cone of light the more an objective magnifies", () => {
    expect(numericalAperture(4)).toBe(0.13);
    expect(numericalAperture(10)).toBe(0.25);
    expect(numericalAperture(40)).toBe(0.65);
  });

  it("names the power, the aperture, the tube length and the coverslip", () => {
    const texts = (power: number) =>
      Arr.map(engraving(power, "black").marks, (mark) =>
        mark.kind === "text" ? mark.text : ""
      );

    expect(texts(40)).toEqual(["40/0.65", "160/0.17"]);
    expect(texts(4)).toEqual(["4/0.13", "160/-"]);
  });

  it("fits between the collar and the colour ring of the shortest objective", () => {
    const band = ringBand(4);
    const sheet = engraving(4, "black");

    expect(ENGRAVING_DROP - sheet.height / 2).toBeGreaterThan(0.0055);
    expect(-ENGRAVING_DROP - sheet.height / 2).toBeGreaterThan(
      band.y + band.height / 2
    );
  });
});

describe("hubPlace", () => {
  it("hangs the objective in use straight over the optical axis, one parfocal distance above the specimen", () => {
    const hub = hubPlace();
    const { mount, tilt, underside } = MOUNTING;
    const shoulder =
      hub.height - underside * Math.cos(tilt) - mount * Math.sin(tilt);
    const depth =
      hub.depth + mount * Math.cos(tilt) - underside * Math.sin(tilt);

    expect(shoulder).toBeCloseTo(STAGE.top + SLIDE.thick + PARFOCAL);
    expect(depth).toBeCloseTo(AXIS);
  });
});

describe("softened", () => {
  it("keeps the ends and replaces each inner corner with a short arc inside it", () => {
    const rings = softened(
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      0.2
    );

    expect(rings[0]).toEqual([0, 0]);
    expect(Option.getOrThrow(Arr.last(rings))).toEqual([1, 1]);
    expect(rings).toHaveLength(7);
    expect(rings[1]?.[0]).toBeCloseTo(0.8);
    expect(rings[1]?.[1]).toBeCloseTo(0);
    expect(rings[5]?.[0]).toBeCloseTo(1);
    expect(rings[5]?.[1]).toBeCloseTo(0.2);
    expect(rings[3]?.[0]).toBeLessThan(1);
    expect(rings[3]?.[1]).toBeGreaterThan(0);
  });
});

describe("knobProfile", () => {
  it("turns a drum of the given radius and depth with a dished face", () => {
    const rings = knobProfile(0.02, 0.01);
    const radii = Arr.map(rings, ([radius]) => radius);
    const heights = Arr.map(rings, ([, height]) => height);

    expect(Math.max(...radii)).toBeCloseTo(0.02);
    expect(Math.max(...heights)).toBeCloseTo(0.01);
    expect(Option.getOrThrow(Arr.last(rings))[1]).toBeLessThan(0.01);
  });
});

describe("smearOutline", () => {
  it("wanders around a blot about eleven millimetres across", () => {
    const reaches = Arr.map(smearOutline(64), ([x, z]) => Math.hypot(x, z));

    expect(reaches).toHaveLength(64);
    expect(Math.min(...reaches)).toBeGreaterThan(0.004);
    expect(Math.max(...reaches)).toBeLessThan(0.007);
    expect(Math.max(...reaches) - Math.min(...reaches)).toBeGreaterThan(0.0008);
  });
});
