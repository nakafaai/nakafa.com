import type { Sheet } from "@repo/design-system/components/three/print/sheet";
import { words } from "@repo/design-system/components/three/print/sheet";
import { Array as Arr } from "effect";

/**
 * The shapes a school compound microscope is turned and cast from, in
 * metres: the profile a lathe sweeps around an axis for every round part,
 * and the outline of the limb seen from the side. A profile is a run of
 * rings, each a radius and a height along the axis.
 */

/**
 * The distance from the shoulder an objective screws in by to the specimen it
 * is focused on, which the standard keeps the same for every objective (DIN
 * 45 mm), so turning the nosepiece keeps the specimen in focus.
 */
export const PARFOCAL = 0.045;

/** How far toward the reader the optical axis stands from the middle of the foot. */
export const AXIS = 0.012;

/** The stage plate: its size, the height of its top, and the opening the light comes up through. */
export const STAGE = {
  depth: 0.125,
  opening: 0.011,
  thick: 0.007,
  top: 0.14,
  width: 0.13,
} as const;

/** A standard slide, 76 mm by 26 mm and 1.2 mm thick, and the coverslip on it. */
export const SLIDE = {
  cover: 0.000_17,
  long: 0.076,
  thick: 0.0012,
  wide: 0.026,
} as const;

/**
 * How the objectives hang from the nosepiece: how far its axis leans back,
 * how far from the axis each objective screws in, and how far below the
 * nosepiece's middle its flat underside lies. Each objective leans out from
 * the axis as far as the axis leans back, so the one turned to the front
 * hangs straight down.
 */
export const MOUNTING = { mount: 0.019, tilt: 0.42, underside: 0.006 } as const;

/** The radius of the standard objective thread (RMS, 20.32 mm across). */
const THREAD = 0.0101;

/** How many straight steps round a corner off. */
const CORNER_STEPS = 4;

/**
 * How far the front lens of an objective stands from the specimen in focus:
 * about 18 mm at a power of 4 and under a millimetre at 40, because a
 * stronger lens has a shorter focal length.
 */
export function workingDistance(power: number) {
  return 0.022 / (1 + (power / 9) ** 2.1);
}

/** How long an objective is from its shoulder to its front lens: stronger objectives are longer. */
export function objectiveLength(power: number) {
  return PARFOCAL - workingDistance(power);
}

/** The radius of the front lens mount of an objective, smaller the stronger it is. */
export function frontRadius(power: number) {
  return 0.0024 + 0.0072 / Math.sqrt(power);
}

/**
 * Where the hub of the nosepiece sits, as height and depth toward the
 * reader: placed so the shoulder of the objective in use stands one parfocal
 * distance above the specimen on the slide, straight over the optical axis.
 */
export function hubPlace() {
  const { mount, tilt, underside } = MOUNTING;
  const drop = underside * Math.cos(tilt) + mount * Math.sin(tilt);
  const reach = mount * Math.cos(tilt) - underside * Math.sin(tilt);
  return {
    depth: AXIS - reach,
    height: STAGE.top + SLIDE.thick + PARFOCAL + drop,
  };
}

/**
 * The ragged edge of a stained smear on a slide, as `count` points around
 * it across and toward the reader: a blot about 11 mm across whose edge
 * wanders as a drop spread under a coverslip does.
 */
export function smearOutline(count: number) {
  return Arr.makeBy(count, (step) => {
    const around = (step / count) * 2 * Math.PI;
    const reach =
      0.0055 *
      (1 +
        0.13 * Math.sin(3 * around + 0.6) +
        0.07 * Math.sin(7 * around + 2.1) +
        0.04 * Math.sin(13 * around));
    return [Math.cos(around) * reach, Math.sin(around) * reach] as const;
  });
}

/**
 * Rounds the corner at `corner` between the ring before it and the ring
 * after, cutting it back by `cut` along each side and joining the two cuts
 * with a short arc of straight steps.
 */
function rounded(
  before: readonly [number, number],
  corner: readonly [number, number],
  after: readonly [number, number],
  cut: number
) {
  const [cornerRadius, cornerHeight] = corner;
  const back = Math.hypot(before[0] - cornerRadius, before[1] - cornerHeight);
  const ahead = Math.hypot(after[0] - cornerRadius, after[1] - cornerHeight);
  const start = [
    cornerRadius + ((before[0] - cornerRadius) / back) * cut,
    cornerHeight + ((before[1] - cornerHeight) / back) * cut,
  ] as const;
  const end = [
    cornerRadius + ((after[0] - cornerRadius) / ahead) * cut,
    cornerHeight + ((after[1] - cornerHeight) / ahead) * cut,
  ] as const;
  return Arr.makeBy(CORNER_STEPS + 1, (step) => {
    const along = step / CORNER_STEPS;
    const first = (1 - along) ** 2;
    const middle = 2 * along * (1 - along);
    const last = along ** 2;
    return [
      first * start[0] + middle * cornerRadius + last * end[0],
      first * start[1] + middle * cornerHeight + last * end[1],
    ] as const;
  });
}

/**
 * A profile with every inner corner rounded off by `cut`, so a turned part
 * catches the light along its edges as machined metal does instead of
 * meeting in a knife edge. The first and last rings stay where they are.
 */
export function softened(
  rings: readonly (readonly [number, number])[],
  cut: number
) {
  return Arr.flatMap(rings, (ring, index) => {
    const before = rings[index - 1];
    const after = rings[index + 1];
    return before === undefined || after === undefined
      ? [ring]
      : rounded(before, ring, after, cut);
  });
}

/**
 * The profile of an objective of one power, hanging down from its shoulder
 * at height 0: the thread, the knurled collar it is turned by, the barrel
 * that carries its engraving and colour ring, a narrower sleeve, and the
 * cone down to the front lens mount.
 */
export function objectiveProfile(power: number) {
  const length = objectiveLength(power);
  const front = frontRadius(power);
  return softened(
    [
      [0, 0.004],
      [THREAD, 0.004],
      [THREAD, -0.001],
      [0.0126, -0.001],
      [0.0126, -0.0055],
      [0.0116, -0.0055],
      [0.0116, -length * 0.58],
      [0.0104, -length * 0.58],
      [0.0104, -length * 0.8],
      [front + 0.0012, -length + 0.0012],
      [front, -length],
      [0, -length],
    ],
    0.0004
  );
}

/** Where the colour ring of an objective sits below its shoulder and how tall it is. */
export function ringBand(power: number) {
  const length = objectiveLength(power);
  return { height: length * 0.07, radius: 0.011_75, y: -length * 0.52 };
}

/**
 * The numerical aperture of an achromatic objective of one power, which
 * says how wide a cone of light it gathers: about 0.13 at a power of 4,
 * 0.25 at 10 and 0.65 at 40.
 */
export function numericalAperture(power: number) {
  return Math.round(0.05 * power ** 0.6953 * 100) / 100;
}

/** How far below its shoulder the middle of an objective's engraving sits. */
export const ENGRAVING_DROP = 0.0092;

/**
 * What a maker engraves round the barrel of an objective: its power over
 * its numerical aperture, and under that the tube length it is corrected
 * for, 160 mm, over the coverslip thickness it expects, 0.17 mm. A weak
 * objective works with any coverslip, which a dash says.
 *
 * @param power - The power of the objective
 * @param ink - The paint the cut letters are filled with
 */
export function engraving(power: number, ink: string): Sheet {
  return {
    height: 0.0066,
    marks: [
      words({
        at: [0, 0.0016],
        ink,
        size: 0.0026,
        text: `${power}/${numericalAperture(power).toFixed(2)}`,
      }),
      words({
        at: [0, -0.0017],
        ink,
        size: 0.0021,
        text: power < 10 ? "160/-" : "160/0.17",
        weight: 500,
      }),
    ],
    width: 0.021,
  };
}

/**
 * The profile of a focus knob lying along its axis from 0 to `depth`: a
 * drum with rounded shoulders, a grip around its rim, and a face dished
 * toward the middle.
 */
export function knobProfile(radius: number, depth: number) {
  return softened(
    [
      [0, 0],
      [radius, 0],
      [radius, depth],
      [radius * 0.62, depth],
      [radius * 0.56, depth - depth * 0.12],
      [0, depth - depth * 0.16],
    ],
    Math.min(radius, depth) * 0.07
  );
}

/**
 * The profile of the eyepiece from the top of its tube at height 0: the
 * chromed sleeve that slides into the tube, the knurled barrel, and the
 * rubber eyecup that curls in over the eye lens.
 */
export const EYEPIECE = softened(
  [
    [0.0098, -0.012],
    [0.0115, -0.012],
    [0.0115, 0.004],
    [0.0152, 0.006],
    [0.0152, 0.02],
    [0.0172, 0.023],
    [0.0168, 0.034],
    [0.0128, 0.036],
    [0.0104, 0.033],
    [0.0104, 0.03],
  ],
  0.0008
);

/**
 * The profile of the revolving nosepiece about its own axis: a shallow dome
 * on top, a knurled rim to turn it by, and the flat underside the
 * objectives screw into.
 */
export const NOSEPIECE = softened(
  [
    [0, 0.011],
    [0.012, 0.011],
    [0.03, 0.005],
    [0.034, 0.002],
    [0.034, -0.004],
    [0.031, -0.006],
    [0, -0.006],
  ],
  0.001
);

/**
 * The profile of the condenser under the stage from its top lens at height
 * 0 down: the lens mount, the body, the knurled ring that opens the iris,
 * and the holder a filter drops into.
 */
export const CONDENSER = softened(
  [
    [0, 0],
    [0.0105, 0],
    [0.0115, -0.006],
    [0.0165, -0.008],
    [0.0165, -0.019],
    [0.0195, -0.02],
    [0.0195, -0.027],
    [0.015, -0.029],
    [0.015, -0.035],
    [0, -0.035],
  ],
  0.0006
);

/**
 * The profile of the head from the top of the limb at height 0: the round
 * housing of the prism that turns the light toward the eye, domed on top.
 */
export const HEAD = softened(
  [
    [0, 0],
    [0.027, 0],
    [0.029, 0.004],
    [0.029, 0.018],
    [0.022, 0.033],
    [0.011, 0.04],
    [0, 0.04],
  ],
  0.002
);

/**
 * The profile of the lamp's collar from the top of the foot at height 0: a
 * raised ring whose inner step holds the field lens.
 */
export const LAMP = softened(
  [
    [0.0195, 0],
    [0.0215, 0.0015],
    [0.0215, 0.0095],
    [0.0185, 0.0125],
    [0.0166, 0.0125],
    [0.0166, 0.0086],
    [0, 0.0086],
  ],
  0.0005
);

/**
 * The outline of the limb seen from the side, as depth toward the reader and
 * height: a pillar that rises from the back of the foot, leans over the
 * stage, and ends in the block that carries the head and the nosepiece. The
 * outline runs up the back and returns down the inside.
 */
export const LIMB = {
  back: [
    [-0.098, 0.028],
    [-0.104, 0.1],
    [-0.1, 0.17],
    [-0.084, 0.226],
    [-0.052, 0.262],
    [-0.008, 0.276],
    [0.034, 0.276],
  ],
  inside: [
    [0.034, 0.226],
    [-0.012, 0.224],
    [-0.04, 0.206],
    [-0.054, 0.17],
    [-0.056, 0.1],
    [-0.05, 0.028],
  ],
} as const;
