import type { Organ } from "@repo/design-system/components/contents/biology/gametogenesis/tissue";
import { organ } from "@repo/design-system/components/contents/biology/gametogenesis/tissue";
import type { Form } from "@repo/design-system/components/three/organism/form";
import type { Station } from "@repo/design-system/components/three/organism/loft";
import {
  duct,
  ovoid,
} from "@repo/design-system/components/three/organism/loft";
import { scatter } from "@repo/design-system/components/three/organism/scatter";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { Array as Arr } from "effect";
import { Color } from "three";

const PINK = new Color(BIOLOGY_COLORS.tissuePink);
const DEEP = new Color(BIOLOGY_COLORS.tissueDeep);
const PALE = new Color(BIOLOGY_COLORS.tubuleLumen);
const AMBER = new Color(BIOLOGY_COLORS.leydigAmber);
const GOLD = new Color(BIOLOGY_COLORS.luteumGold);
const IVORY = new Color(BIOLOGY_COLORS.zonaPellucida);

/** An egg-shaped organ stood on end at `x` and `y`: its long axis runs up the body. */
function upright(
  stations: readonly Station[],
  x: number,
  y: number
): readonly Station[] {
  return Arr.map(stations, (station) => ({
    ...station,
    centre: [x, y + station.centre[0], 0],
  }));
}

/**
 * The male reproductive tract in side view, front of the body towards -x:
 * the testis with the epididymis capping its back, the sperm duct that
 * climbs from the epididymis, arches over the bladder and joins the seminal
 * vesicle's duct inside the prostate, the bulbourethral gland, and the
 * urethra that runs from the bladder through the prostate and the penis.
 */
export function maleForms(detail: number): readonly Form[] {
  const parts: readonly Organ[] = [
    {
      along: 48,
      around: 40,
      deep: PINK,
      lobes: 0,
      lump: 0.05,
      pale: IVORY,
      seed: 3,
      stations: upright(ovoid([0, 0, 0], 0.3, 0.105, 0.1, 0.15), -0.34, 0.27),
    },
    {
      along: 96,
      around: 20,
      deep: DEEP,
      lobes: 34,
      lump: 0.12,
      pale: AMBER,
      seed: 5,
      stations: duct([
        [-0.37, 0.43, 0.01, 0],
        [-0.3, 0.44, 0.012, 0.045],
        [-0.225, 0.4, 0.014, 0.04],
        [-0.2, 0.3, 0.014, 0.026],
        [-0.215, 0.18, 0.012, 0.024],
        [-0.27, 0.115, 0.01, 0.03],
        [-0.25, 0.15, 0.03, 0.014],
      ]),
    },
    {
      along: 120,
      around: 14,
      deep: PINK,
      lobes: 0,
      lump: 0.04,
      pale: PALE,
      seed: 7,
      stations: duct([
        [-0.25, 0.15, 0.03, 0.013],
        [-0.17, 0.3, -0.05, 0.012],
        [-0.16, 0.6, -0.08, 0.012],
        [-0.1, 0.86, -0.03, 0.012],
        [0.08, 1.0, 0.05, 0.012],
        [0.27, 0.96, 0.05, 0.013],
        [0.33, 0.82, 0.03, 0.016],
        [0.26, 0.7, 0.015, 0.014],
        [0.2, 0.66, 0.005, 0.006],
      ]),
    },
    {
      along: 56,
      around: 44,
      deep: AMBER,
      lobes: 0,
      lump: 0.07,
      pale: PALE,
      seed: 9,
      stations: [
        { centre: [0.12, 0.66, 0], tall: 0, wide: 0 },
        { centre: [0.1, 0.7, 0], tall: 0.05, wide: 0.05 },
        { centre: [0.06, 0.8, 0], tall: 0.12, wide: 0.12 },
        { centre: [0.04, 0.9, 0], tall: 0.115, wide: 0.125 },
        { centre: [0.03, 0.965, 0], tall: 0.06, wide: 0.07 },
        { centre: [0.03, 0.98, 0], tall: 0, wide: 0 },
      ],
    },
    {
      along: 72,
      around: 22,
      deep: DEEP,
      lobes: 15,
      lump: 0.22,
      pale: GOLD,
      seed: 11,
      stations: duct([
        [0.21, 0.67, -0.02, 0.008],
        [0.27, 0.72, -0.045, 0.03],
        [0.33, 0.8, -0.06, 0.04],
        [0.37, 0.9, -0.06, 0.034],
        [0.385, 0.95, -0.06, 0],
      ]),
    },
    {
      along: 40,
      around: 36,
      deep: DEEP,
      lobes: 0,
      lump: 0.08,
      pale: PINK,
      seed: 13,
      stations: ovoid([0.15, 0.6, 0], 0.17, 0.085, 0.07, 0.4),
    },
    {
      along: 16,
      around: 16,
      deep: AMBER,
      lobes: 0,
      lump: 0.1,
      pale: GOLD,
      seed: 15,
      stations: ovoid([0.12, 0.5, 0.03], 0.04, 0.018, 0.018, 0),
    },
    {
      along: 96,
      around: 36,
      deep: DEEP,
      lobes: 0,
      lump: 0.03,
      pale: PINK,
      seed: 17,
      stations: duct([
        [0.14, 0.56, 0, 0.02],
        [0.1, 0.5, 0, 0.034],
        [0.0, 0.46, 0, 0.05],
        [-0.1, 0.44, 0, 0.052],
        [-0.3, 0.52, 0, 0.05],
        [-0.48, 0.5, 0, 0.049],
        [-0.6, 0.36, 0, 0.048],
        [-0.63, 0.26, 0, 0.046],
        [-0.64, 0.2, 0, 0.062],
        [-0.65, 0.13, 0, 0.05],
        [-0.655, 0.1, 0, 0],
      ]),
    },
  ];
  return Arr.map(parts, (part) => organ(part, detail));
}

/** One uterine tube from the womb's corner out to its funnel, on the side `side` names. */
function oviduct(side: -1 | 1): readonly Station[] {
  return duct([
    [side * 0.13, 0.8, 0, 0.012],
    [side * 0.26, 0.9, 0.01, 0.016],
    [side * 0.44, 0.93, 0.02, 0.022],
    [side * 0.6, 0.88, 0.03, 0.034],
    [side * 0.68, 0.76, 0.04, 0.05],
    [side * 0.69, 0.71, 0.04, 0.03],
  ]);
}

/**
 * The female reproductive tract seen from the front: the pear-shaped womb
 * narrowing to its neck, the vagina below it, a uterine tube arching from
 * each upper corner to the funnel that hangs over an ovary, each ovary
 * knobbed with ripening follicles, and the ligament that ties it to the
 * womb.
 */
export function femaleForms(detail: number): readonly Form[] {
  const parts: readonly Organ[] = [
    {
      along: 96,
      around: 48,
      deep: DEEP,
      lobes: 0,
      lump: 0.04,
      pale: PINK,
      seed: 21,
      stations: [
        { centre: [0, 0.06, 0], tall: 0.04, wide: 0.07 },
        { centre: [0, 0.18, 0], tall: 0.042, wide: 0.075 },
        { centre: [0, 0.32, 0], tall: 0.045, wide: 0.07 },
        { centre: [0, 0.4, 0], tall: 0.05, wide: 0.062 },
        { centre: [0, 0.5, 0], tall: 0.06, wide: 0.07 },
        { centre: [0, 0.62, 0], tall: 0.09, wide: 0.13 },
        { centre: [0, 0.76, 0], tall: 0.11, wide: 0.19 },
        { centre: [0, 0.85, 0], tall: 0.1, wide: 0.17 },
        { centre: [0, 0.9, 0], tall: 0, wide: 0 },
      ],
    },
    ...Arr.flatMap([-1, 1] as const, (side): readonly Organ[] => [
      {
        along: 72,
        around: 20,
        deep: DEEP,
        lobes: 9,
        lump: 0.08,
        pale: PINK,
        seed: 23 + side,
        stations: oviduct(side),
      },
      {
        along: 40,
        around: 40,
        deep: PINK,
        lobes: 0,
        lump: 0.2,
        pale: IVORY,
        seed: 26 + side,
        stations: ovoid([side * 0.56, 0.62, 0.05], 0.2, 0.062, 0.075, 0),
      },
      {
        along: 24,
        around: 10,
        deep: PINK,
        lobes: 0,
        lump: 0.05,
        pale: PALE,
        seed: 29 + side,
        stations: duct([
          [side * 0.15, 0.72, 0.03, 0.01],
          [side * 0.3, 0.66, 0.05, 0.008],
          [side * 0.47, 0.63, 0.05, 0.01],
        ]),
      },
    ]),
  ];
  return Arr.map(parts, (part) => organ(part, detail));
}

/** One fimbria, a unit long along x: a soft finger of the funnel that sweeps the ovary. */
export function fimbriaForms(detail: number): readonly Form[] {
  return [
    organ(
      {
        along: 16,
        around: 8,
        deep: DEEP,
        lobes: 3,
        lump: 0.1,
        pale: PINK,
        seed: 31,
        stations: duct([
          [0, 0, 0, 0.16],
          [0.5, 0.06, 0, 0.13],
          [0.9, 0.2, 0, 0.08],
          [1, 0.24, 0, 0],
        ]),
      },
      detail
    ),
  ];
}

/** The fringe of fimbriae round the mouth of each uterine tube, reaching down towards its ovary. */
export function fimbriae(count: number) {
  return scatter(count * 2, 37, (index, chance) => {
    const side = index % 2 === 0 ? -1 : 1;
    const turn = (Math.floor(index / 2) / count) * 2 * Math.PI;
    const long = 0.05 + 0.035 * chance(1);
    return {
      lean: [turn, 0, -Math.PI / 2 + 0.5 * Math.cos(turn) * side],
      place: [
        side * 0.69 + 0.03 * Math.cos(turn),
        0.71,
        0.04 + 0.03 * Math.sin(turn),
      ],
      size: [long, long * 0.55, long * 0.55],
    };
  });
}
