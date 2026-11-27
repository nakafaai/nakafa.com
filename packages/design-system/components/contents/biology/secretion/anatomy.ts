import { fractalAt } from "@repo/design-system/components/three/field/noise";
import { faces } from "@repo/design-system/components/three/organism/budget";
import type { Form } from "@repo/design-system/components/three/organism/form";
import type { Station } from "@repo/design-system/components/three/organism/loft";
import {
  loftBody,
  ovoid,
} from "@repo/design-system/components/three/organism/loft";
import { moundBody } from "@repo/design-system/components/three/organism/mound";
import { scatter } from "@repo/design-system/components/three/organism/scatter";
import { ENZYME_COLORS } from "@repo/design-system/lib/material/enzyme";
import { Array as Arr } from "effect";
import { Color } from "three";

const CYTOPLASM = new Color(ENZYME_COLORS.cytoplasm);
const SHELL = new Color(ENZYME_COLORS.cellShell);
const DUCT = new Color(ENZYME_COLORS.ductWall);
const NUCLEUS = new Color(ENZYME_COLORS.nucleus);
const RETICULUM = new Color(ENZYME_COLORS.reticulum);
const RIBOSOME = new Color(ENZYME_COLORS.ribosome);
const GOLGI = new Color(ENZYME_COLORS.golgi);
const VESICLE = new Color(ENZYME_COLORS.vesicle);
const CARGO = new Color(ENZYME_COLORS.cargo);

/** Where the nucleus sits in the cell. */
const CORE = [-1.05, 0.36, 0] as const;

/** How far a value has passed an edge, from 0 just before it to 1 just after: a soft border. */
function blend(value: number, edge: number, steep: number) {
  return Math.min(1, Math.max(0, (value - edge) * steep + 0.5));
}

/** How far the cell reaches from its middle at a turn round it: a rounded block, as acinar cells pack. */
function outline(turn: number) {
  const angle = turn * 2 * Math.PI;
  return (
    (Math.abs(Math.cos(angle) / 1.5) ** 5 +
      Math.abs(Math.sin(angle) / 0.9) ** 5) **
    (-1 / 5)
  );
}

/**
 * The acinar cell cut open from above: a bed of grainy cytoplasm inside its
 * membrane, which stands as a wall round the back of the cut and is the
 * duct's wall on the right, where the cell secretes.
 */
export function cellForms(detail: number): readonly Form[] {
  return [
    moundBody({
      height: (out, turn) => {
        const back = 0.5 - 0.5 * Math.sin(turn * 2 * Math.PI);
        const wall = 0.2 * back * blend(out, 0.93, 40);
        return (0.15 + wall) * (1 - blend(out, 0.985, 80));
      },
      paint: (out, turn, color) => {
        const reach = out * outline(turn);
        const across = 0.5 + (reach * Math.cos(turn * 2 * Math.PI)) / 4;
        const deep = 0.5 + (reach * Math.sin(turn * 2 * Math.PI)) / 4;
        const grain = fractalAt(across, deep, 60, 60, 281, 3);
        const specks = blend(fractalAt(across, deep, 150, 150, 283, 1), 0.74, 30);
        const duct = blend(Math.cos(turn * 2 * Math.PI), 0.8, 12);
        color
          .copy(CYTOPLASM)
          .lerp(SHELL, 0.2 + 0.5 * grain)
          .lerp(RIBOSOME, 0.22 * specks)
          .lerp(SHELL, blend(out, 0.9, 30))
          .lerp(DUCT, blend(out, 0.9, 30) * (0.35 + 0.65 * duct));
      },
      rim: outline,
      rings: faces(110, detail),
      spokes: faces(220, detail),
    }),
  ];
}

/** One small round body a unit in radius, in two tones: a ribosome, a granule, a vesicle. */
function bead(deep: Color, pale: Color, lump: number, fine: number, seed: number) {
  return loftBody({
    along: fine,
    around: fine,
    belly: 0,
    lump,
    paint: (along, around, color) => {
      color.copy(deep).lerp(pale, fractalAt(along, around, 4, 4, seed, 2));
    },
    relief: () => 0,
    seed,
    square: 2,
    stations: ovoid([0, 0, 0], 2, 1, 1, 0),
    up: [0, 1, 0],
  });
}

/**
 * The nucleus, where the gene for the enzyme is copied into messenger RNA:
 * a round body with a mottled envelope.
 */
export function nucleusForms(detail: number): readonly Form[] {
  return [
    loftBody({
      along: faces(56, detail),
      around: faces(56, detail),
      belly: 0,
      lump: 0.05,
      paint: (along, around, color) => {
        const pores = blend(fractalAt(along, around, 22, 44, 285, 1), 0.7, 20);
        color
          .copy(NUCLEUS)
          .lerp(CYTOPLASM, 0.3 * fractalAt(along, around, 6, 6, 287, 3))
          .lerp(RIBOSOME, 0.4 * pores);
      },
      relief: () => 0,
      seed: 289,
      square: 2,
      stations: ovoid(CORE, 0.66, 0.32, 0.31, 0),
      up: [0, 1, 0],
    }),
  ];
}

/** One sheet of rough endoplasmic reticulum, a flattened sac that curves round the nucleus `far` from its middle. */
function sheet(far: number, index: number): readonly Station[] {
  const sweep = 0.95 - 0.07 * index;
  return Arr.makeBy(25, (step): Station => {
    const share = step / 24;
    const angle = (share - 0.5) * 2 * sweep + 0.12 * Math.sin(index * 2.4);
    const wave = 0.03 * Math.sin(share * 13 + index * 1.7);
    const taper = Math.sin(Math.PI * share) ** 0.35;
    return {
      centre: [
        CORE[0] + (far + wave) * Math.cos(angle),
        0.25,
        (far + wave) * Math.sin(angle),
      ],
      tall: 0.1 * taper,
      wide: 0.017 * taper,
    };
  });
}

/**
 * The rough endoplasmic reticulum: stacked, folded sacs round the nucleus,
 * studded with the ribosomes that thread the new enzyme into them.
 */
export function reticulumForms(detail: number): readonly Form[] {
  return Arr.makeBy(5, (index) =>
    loftBody({
      along: faces(120, detail),
      around: faces(14, detail),
      belly: 0,
      lump: 0.1,
      paint: (along, around, color) => {
        const studs = blend(
          fractalAt(along, around, 70, 6, 291 + index, 1),
          0.6,
          14
        );
        color
          .copy(RETICULUM)
          .lerp(CYTOPLASM, 0.25 * fractalAt(along, around, 9, 3, 293, 2))
          .lerp(RIBOSOME, 0.75 * studs);
      },
      relief: (along, around) =>
        0.16 * blend(fractalAt(along, around, 70, 6, 291 + index, 1), 0.6, 6),
      seed: 295 + index,
      square: 2.6,
      stations: sheet(0.47 + 0.085 * index, index),
      up: [0, 1, 0],
    })
  );
}

/** One cisterna of the Golgi apparatus: a curved, flattened sac with swollen rims, `rank` sacs from the middle of the stack. */
function cisterna(rank: number): readonly Station[] {
  const half = 0.3 - 0.035 * Math.abs(rank + 0.6);
  return Arr.makeBy(21, (step): Station => {
    const share = step / 20;
    const rim = Math.abs(2 * share - 1) ** 6;
    const taper = Math.sin(Math.PI * share) ** 0.3;
    return {
      centre: [
        0.42 + 0.07 * rank - 0.1 * Math.cos(Math.PI * (share - 0.5)),
        0.25,
        -0.02 + (2 * share - 1) * half,
      ],
      tall: (0.085 + 0.02 * rim) * taper,
      wide: (0.016 + 0.02 * rim) * taper,
    };
  });
}

/**
 * The Golgi apparatus: a stack of curved sacs that take the enzyme in on
 * the side facing the reticulum, finish it, and pack it into vesicles on
 * the side facing the membrane.
 */
export function golgiForms(detail: number): readonly Form[] {
  return Arr.makeBy(5, (index) =>
    loftBody({
      along: faces(72, detail),
      around: faces(14, detail),
      belly: 0,
      lump: 0.12,
      paint: (along, around, color) => {
        color
          .copy(GOLGI)
          .lerp(CYTOPLASM, 0.35 * fractalAt(along, around, 12, 3, 297, 3))
          .lerp(CARGO, 0.12 * index);
      },
      relief: () => 0,
      seed: 299 + index,
      square: 2.4,
      stations: cisterna(index - 2),
      up: [0, 1, 0],
    })
  );
}

/** One secretory granule or transport vesicle, a unit in radius, full of enzyme. */
export function granuleForms(detail: number): readonly Form[] {
  return [bead(VESICLE, CYTOPLASM.clone().lerp(VESICLE, 0.55), 0.06, faces(18, detail), 301)];
}

/**
 * Where the cell's vesicles lie: small ones on their way from the
 * reticulum to the Golgi and budding from its far side, and the large
 * secretory granules crowded under the membrane that faces the duct.
 */
export function granulePlacements() {
  return scatter(48, 303, (index, chance) => {
    const stored = index < 34;
    const budding = index >= 42;
    const start = budding ? 0.62 : -0.02;
    const size = stored ? 0.04 + 0.035 * chance(4) : 0.024 + 0.012 * chance(4);
    return {
      lean: [chance(5) * 6, chance(6) * 6, 0],
      place: [
        stored ? 0.84 + 0.5 * chance(1) ** 0.7 : start + 0.2 * chance(1),
        0.17 + size + 0.06 * chance(2),
        stored ? -0.62 + 1.24 * chance(3) : -0.3 + 0.6 * chance(3),
      ],
      size: [size, size, size],
    };
  });
}

/** One ribosome, a unit in radius. */
export function ribosomeForms(): readonly Form[] {
  return [bead(RIBOSOME, RETICULUM, 0.2, 8, 305)];
}

/** Where the free ribosomes float in the cytoplasm, towards the viewer: they make the enzymes the cell keeps. */
export function ribosomePlacements() {
  return scatter(70, 307, (_, chance) => ({
    lean: [chance(5) * 6, chance(6) * 6, 0],
    place: [
      -0.85 + 1.45 * chance(1),
      0.165 + 0.03 * chance(2),
      0.3 + 0.42 * chance(3),
    ],
    size: [0.02, 0.016, 0.02],
  }));
}

/** The vesicle that carries the enzyme, a unit in radius. */
export function vesicleForms(detail: number): readonly Form[] {
  return [bead(VESICLE, CYTOPLASM, 0.04, faces(28, detail), 309)];
}

/** The enzyme itself: one folded protein, a knobbly globule a unit in radius. */
export function cargoForms(detail: number): readonly Form[] {
  return [bead(CARGO, GOLGI, 0.45, faces(24, detail), 311)];
}
