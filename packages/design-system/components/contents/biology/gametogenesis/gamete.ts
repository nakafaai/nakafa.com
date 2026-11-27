import { globe } from "@repo/design-system/components/contents/biology/gametogenesis/tissue";
import { fractalAt } from "@repo/design-system/components/three/field/noise";
import { faces } from "@repo/design-system/components/three/organism/budget";
import type { Form } from "@repo/design-system/components/three/organism/form";
import {
  duct,
  loftBody,
} from "@repo/design-system/components/three/organism/loft";
import { scatter } from "@repo/design-system/components/three/organism/scatter";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { CELL_COLORS } from "@repo/design-system/lib/material/cell";
import { Color } from "three";

const HEAD = new Color(BIOLOGY_COLORS.spermHeadBlue);
const CAP = new Color(BIOLOGY_COLORS.acrosomeGold);
const SHEATH = new Color(BIOLOGY_COLORS.midpieceCopper);
const TAIL = new Color(BIOLOGY_COLORS.flagellumIvory);
const YOLK = new Color(BIOLOGY_COLORS.oocyteYolk);
const IVORY = new Color(BIOLOGY_COLORS.zonaPellucida);
const CORONA = new Color(BIOLOGY_COLORS.coronaCell);
const FLUID = new Color(BIOLOGY_COLORS.follicleFluid);
const PALE = new Color(BIOLOGY_COLORS.tubuleLumen);
const CHEEK = new Color(BIOLOGY_COLORS.cheekCell);
const STAIN = new Color(BIOLOGY_COLORS.chromatinStain);
const NUCLEUS = new Color(CELL_COLORS.nucleus);

/** How many turns the mitochondria wind round the middle piece. */
const COILS = 11;

/**
 * A human sperm cell, head towards -x: the flat, pear-shaped head with the
 * acrosome capping its front two thirds, the middle piece wound with a
 * spiral of mitochondria, and the long tail that tapers to nothing.
 */
export function spermForms(detail: number): readonly Form[] {
  const head = loftBody({
    along: faces(48, detail),
    around: faces(36, detail),
    belly: 0,
    lump: 0.03,
    paint: (along, around, color) => {
      const grain = fractalAt(along, around, 9, 7, 91, 3);
      const cap = Math.min(1, Math.max(0, (0.6 - along + 0.05 * grain) * 14));
      color
        .copy(HEAD)
        .lerp(CAP, cap)
        .lerp(TAIL, 0.3)
        .multiplyScalar(0.8 + 0.4 * grain);
    },
    relief: (along) => (along < 0.56 ? 0.035 : 0),
    seed: 93,
    square: 2,
    stations: [
      { centre: [-0.62, 0, 0], tall: 0, wide: 0 },
      { centre: [-0.605, 0, 0], tall: 0.04, wide: 0.026 },
      { centre: [-0.55, 0, 0], tall: 0.082, wide: 0.05 },
      { centre: [-0.48, 0, 0], tall: 0.094, wide: 0.058 },
      { centre: [-0.42, 0, 0], tall: 0.07, wide: 0.05 },
      { centre: [-0.385, 0, 0], tall: 0.036, wide: 0.032 },
      { centre: [-0.37, 0, 0], tall: 0.03, wide: 0.03 },
    ],
    up: [0, 1, 0],
  });
  const coil = (along: number, around: number) =>
    Math.sin(2 * Math.PI * (COILS * along + around)) *
    Math.sin(Math.PI * along) ** 0.3;
  const middle = loftBody({
    along: faces(176, detail),
    around: faces(24, detail),
    belly: 0,
    lump: 0,
    paint: (along, around, color) => {
      color.copy(SHEATH).multiplyScalar(0.72 + 0.3 * coil(along, around));
    },
    relief: (along, around) => 0.2 * coil(along, around),
    seed: 95,
    square: 2,
    stations: duct([
      [-0.375, 0, 0, 0.03],
      [-0.33, 0, 0, 0.038],
      [-0.2, 0, 0, 0.036],
      [-0.09, 0, 0, 0.032],
      [-0.07, 0, 0, 0.02],
    ]),
    up: [0, 1, 0],
  });
  const tail = loftBody({
    along: faces(120, detail),
    around: faces(12, detail),
    belly: 0,
    lump: 0,
    paint: (along, around, color) => {
      color
        .copy(TAIL)
        .multiplyScalar(0.85 + 0.3 * fractalAt(along, around, 30, 3, 97, 2));
    },
    relief: () => 0,
    seed: 97,
    square: 2,
    stations: duct([
      [-0.075, 0, 0, 0.018],
      [0.14, 0.048, 0.025, 0.014],
      [0.38, -0.042, -0.02, 0.012],
      [0.62, 0.036, 0.018, 0.009],
      [0.82, -0.012, 0, 0.005],
      [0.84, -0.015, 0, 0],
    ]),
    up: [0, 1, 0],
  });
  return [head, middle, tail];
}

/**
 * A ripe egg cell: its yolky cytoplasm, a little uneven, and the first
 * polar body lying against it under the zona pellucida.
 */
export function ovumForms(detail: number): readonly Form[] {
  return [
    globe([0, 0, 0], 0.28, 0.04, YOLK, IVORY, detail),
    globe([-0.21, 0.19, 0.12], 0.042, 0.08, PALE, CORONA, detail),
  ];
}

/** The zona pellucida: the clear, thick coat round the egg cell. */
export function zonaForms(detail: number): readonly Form[] {
  return [globe([0, 0, 0], 0.34, 0.012, IVORY, IVORY, detail)];
}

/** A pocket of follicular fluid beside the egg cell. */
export function antrumForms(detail: number): readonly Form[] {
  return [globe([0.3, -0.1, 0.2], 0.115, 0.1, FLUID, FLUID, detail)];
}

/** One follicular cell of the corona radiata, a unit long along x and rooted at its start. */
export function coronaForms(detail: number): readonly Form[] {
  return [globe([0.5, 0, 0], 0.5, 0.16, CORONA, IVORY, detail)];
}

/**
 * The corona radiata: follicular cells that stand out from the zona all
 * round the egg, left open towards the viewer so the egg shows.
 */
export function coronaCells(count: number) {
  return scatter(count, 99, (index, chance) => {
    const deep = 0.3 - (1.3 * (index + 0.5)) / count;
    const flat = Math.sqrt(1 - deep * deep);
    const bearing = index * 2.399_963;
    const x = flat * Math.cos(bearing);
    const y = flat * Math.sin(bearing);
    const long = 0.06 + 0.035 * chance(1);
    const thick = 0.058 + 0.02 * chance(2);
    return {
      lean: [0, Math.atan2(-deep, x), Math.asin(y)],
      place: [0.33 * x, 0.33 * y, 0.33 * deep],
      size: [long, thick, thick],
    };
  });
}

/** A male germ cell in division, a unit in radius. */
export function germForms(detail: number): readonly Form[] {
  return [globe([0, 0, 0], 1, 0.035, HEAD, CHEEK, detail)];
}

/** A female germ cell in division, a unit in radius, heavy with yolk. */
export function eggForms(detail: number): readonly Form[] {
  return [globe([0, 0, 0], 1, 0.035, YOLK, IVORY, detail)];
}

/** A polar body, a unit in radius: the small cell that takes the spare chromosomes. */
export function polarForms(detail: number): readonly Form[] {
  return [globe([0, 0, 0], 1, 0.07, CORONA, PALE, detail)];
}

/** The stained nucleus of a dividing cell, for a cell a unit in radius. */
export function nucleusForms(detail: number): readonly Form[] {
  return [globe([0, 0, 0], 0.46, 0.1, STAIN, NUCLEUS, detail)];
}
