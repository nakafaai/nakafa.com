import {
  globe,
  organ,
} from "@repo/design-system/components/contents/biology/gametogenesis/tissue";
import {
  fractalAt,
  ridgedAt,
} from "@repo/design-system/components/three/field/noise";
import { faces } from "@repo/design-system/components/three/organism/budget";
import type { Form } from "@repo/design-system/components/three/organism/form";
import type { Loft } from "@repo/design-system/components/three/organism/loft";
import {
  loftBody,
  ovoid,
} from "@repo/design-system/components/three/organism/loft";
import { scatter } from "@repo/design-system/components/three/organism/scatter";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { Color } from "three";

const PINK = new Color(BIOLOGY_COLORS.tissuePink);
const DEEP = new Color(BIOLOGY_COLORS.tissueDeep);
const PALE = new Color(BIOLOGY_COLORS.tubuleLumen);
const IVORY = new Color(BIOLOGY_COLORS.zonaPellucida);
const YOLK = new Color(BIOLOGY_COLORS.oocyteYolk);
const CORONA = new Color(BIOLOGY_COLORS.coronaCell);
const CLOT = new Color(BIOLOGY_COLORS.bloodDark);

/** How far a place on a cut face lies from the middle of the face towards its edge, from -1 to 1. */
function across(around: number) {
  return Math.sin(around * 2 * Math.PI);
}

/** How far a value has passed an edge, from 0 just before it to 1 just after: a soft border. */
function blend(value: number, edge: number) {
  return Math.min(1, Math.max(0, (value - edge) * 30 + 0.5));
}

/**
 * The uterine tube cut open along its length: a muscular wall round a lumen
 * lined with folded, ciliated mucosa, widest at the ampulla where the egg is
 * fertilised and narrowing towards the womb.
 */
const tube: Loft["paint"] = (along, around, color) => {
  const grain = fractalAt(along, around, 30, 9, 211, 3);
  if (around < 0.25 || around > 0.75) {
    color.copy(DEEP).lerp(PINK, 0.3 + 0.5 * grain);
    return;
  }
  const off = Math.abs(across(around));
  const wall = blend(off, 0.62);
  const folds = ridgedAt(along, around, 26, 5, 213, 2);
  color
    .copy(PALE)
    .lerp(DEEP, 0.35 * folds * (1 - wall))
    .lerp(PINK, wall)
    .lerp(DEEP, wall * (0.25 + 0.3 * grain))
    .lerp(IVORY, 0.5 * blend(off, 0.95));
};

/**
 * The womb cut open: the dark band of muscle outside, the thick, spongy
 * lining with its glands and coiled arteries inside it, and the cavity the
 * embryo floats into before it sinks into the lining.
 */
const womb: Loft["paint"] = (along, around, color) => {
  const grain = fractalAt(along, around, 16, 20, 217, 3);
  if (around < 0.25 || around > 0.75) {
    color.copy(DEEP).lerp(PINK, 0.25 + 0.4 * grain);
    return;
  }
  const from = Math.hypot(2 * along - 1.05, across(around) - 0.3);
  const glands = ridgedAt(along, around, 14, 22, 219, 3);
  const lining = blend(from, 0.4);
  const muscle = blend(from, 0.86);
  color
    .copy(CLOT)
    .lerp(DEEP, 0.55 + 0.3 * grain)
    .lerp(PINK, lining)
    .lerp(PALE, lining * (0.25 + 0.35 * grain))
    .lerp(DEEP, lining * blend(glands, 0.68) * 0.55)
    .lerp(DEEP, muscle * (0.75 + 0.2 * grain));
};

/**
 * The organs the embryo travels through, cut open towards the viewer: the
 * ovary it left, the uterine tube, and the womb with its lining.
 */
export function passageForms(detail: number): readonly Form[] {
  return [
    organ(
      {
        along: 48,
        around: 40,
        deep: PINK,
        lobes: 0,
        lump: 0.22,
        pale: IVORY,
        seed: 221,
        stations: ovoid([-1.0, 0.56, -0.05], 0.3, 0.1, 0.1, 0.2),
      },
      detail
    ),
    loftBody({
      along: faces(160, detail),
      around: faces(160, detail),
      belly: 1,
      lump: 0.05,
      paint: tube,
      relief: () => 0,
      seed: 223,
      square: 2.4,
      stations: [
        { centre: [-0.94, 0.72, -0.08], tall: 0, wide: 0 },
        { centre: [-0.9, 0.72, -0.08], tall: 0.14, wide: 0.19 },
        { centre: [-0.7, 0.7, -0.08], tall: 0.17, wide: 0.23 },
        { centre: [-0.4, 0.63, -0.08], tall: 0.16, wide: 0.21 },
        { centre: [-0.1, 0.59, -0.08], tall: 0.15, wide: 0.2 },
        { centre: [0.2, 0.6, -0.08], tall: 0.15, wide: 0.2 },
        { centre: [0.42, 0.62, -0.08], tall: 0.15, wide: 0.19 },
      ],
      up: [0, 0, -1],
    }),
    loftBody({
      along: faces(180, detail),
      around: faces(260, detail),
      belly: 1,
      lump: 0.03,
      paint: womb,
      relief: () => 0,
      seed: 227,
      square: 2.6,
      stations: ovoid([0.68, 0.45, -0.1], 0.86, 0.44, 0.22, -0.1),
      up: [0, 0, -1],
    }),
  ];
}

/** One cell of the early embryo, a unit in radius: a blastomere, or a cell of the inner cell mass. */
export function blastomereForms(detail: number): readonly Form[] {
  return [globe([0, 0, 0], 1, 0.05, YOLK, IVORY, detail)];
}

/** One flattened cell of the trophoblast, a unit in radius: the embryo's outer layer, which makes the placenta. */
export function trophoblastForms(detail: number): readonly Form[] {
  return [globe([0, 0, 0], 1, 0.06, CORONA, PINK, detail)];
}

/** The zona pellucida round the early embryo, a unit in radius. */
export function zonaForms(detail: number): readonly Form[] {
  return [globe([0, 0, 0], 1, 0.012, IVORY, IVORY, detail)];
}

/** Where each cell of the embryo sits, ready for one instanced draw call. */
export function cellPlacements(
  cells: readonly {
    readonly offset: readonly [number, number, number];
    readonly radius: number;
  }[]
) {
  return scatter(cells.length, 229, (index, chance) => {
    const cell = cells[index] ?? { offset: [0, 0, 0], radius: 0 };
    return {
      lean: [chance(1) * 6, chance(2) * 6, 0],
      place: cell.offset,
      size: [cell.radius, cell.radius, cell.radius],
    };
  });
}
