import {
  BEAD,
  HEAP,
  POT,
} from "@repo/design-system/components/contents/mathematics/abacus/rig";
import { Array as Arr } from "effect";

/**
 * The turned profiles of the abacus's round parts, as points (radius,
 * height) that a lathe spins about the vertical axis. Each runs so the lathe
 * faces every surface outward: up the outside, over the top, and down the
 * inside of a bore or a bowl.
 */

/** How many points trace a bead's rounded side. */
const BEAD_STEPS = 18;

/**
 * How full a bead's side is: 1 traces an ellipse, and less squares it off
 * toward the flat-sided rondelle a turned wooden bead has.
 */
const BEAD_FULLNESS = 0.55;

/** The small chamfer where a bead's bore meets its faces, in metres. */
const CHAMFER = 0.0005;

/**
 * A wooden bead's profile: from the bottom of the bore, round the rounded
 * side to the top of the bore, and back down the bore, with a chamfer at
 * each end of it.
 */
export function beadProfile(): readonly (readonly [number, number])[] {
  const inner = BEAD.bore + CHAMFER;
  const side = Arr.map(Arr.range(0, BEAD_STEPS), (step) => {
    const angle = -Math.PI / 2 + (Math.PI * step) / BEAD_STEPS;
    const swell = Math.abs(Math.cos(angle)) ** BEAD_FULLNESS;
    return [
      inner + (BEAD.radius - inner) * swell,
      (BEAD.height / 2) * Math.sin(angle),
    ] as const;
  });
  return [
    ...side,
    [BEAD.bore, BEAD.height / 2 - CHAMFER],
    [BEAD.bore, -BEAD.height / 2 + CHAMFER],
    [inner, -BEAD.height / 2],
  ];
}

/** The height of the pot's inner floor, where the loose beads lie. */
export const POT_FLOOR = HEAP - BEAD.height / 2;

/**
 * The turned walnut pot's profile: out across its foot, up the outer wall,
 * over the rounded lip, down the inner wall and in across the floor the
 * loose beads lie on.
 */
export function potProfile(): readonly (readonly [number, number])[] {
  const outer = POT.radius;
  const inner = POT.radius - POT.wall;
  return [
    [0.0001, 0],
    [outer - 0.008, 0],
    [outer - 0.005, 0.002],
    [outer - 0.003, 0.008],
    [outer, 0.03],
    [outer, POT.height - 0.006],
    [outer - 0.001, POT.height - 0.002],
    [outer - POT.wall / 2, POT.height],
    [inner + 0.001, POT.height - 0.002],
    [inner, POT.height - 0.006],
    [inner, POT_FLOOR + 0.003],
    [inner - 0.003, POT_FLOOR],
    [0.0001, POT_FLOOR],
  ];
}

/** How many loose beads lie in a ring on the pot's floor. */
const LOOSE = 5;

/** How far from the pot's middle the loose beads lie, leaving room down the middle for a carried stack. */
const LOOSE_RING = 0.0245;

/**
 * The loose beads in the pot: a ring lying flat on its floor, each of one of
 * the four places' colours in turn, turned a little so they read as dropped
 * in, never touching each other, the wall, or a stack sinking down the middle.
 */
export function looseBeads() {
  return Arr.map(Arr.range(0, LOOSE - 1), (index) => {
    const angle = (2 * Math.PI * index) / LOOSE + 0.4;
    const tilt = 0.06 * ((index % 3) - 1);
    return {
      place: index % 4,
      tilt,
      x: POT.x + LOOSE_RING * Math.cos(angle),
      // A tilted bead rests on its lower rim, lifted clear of the floor.
      y: HEAP + BEAD.radius * Math.sin(Math.abs(tilt)),
      z: LOOSE_RING * Math.sin(angle),
    };
  });
}
