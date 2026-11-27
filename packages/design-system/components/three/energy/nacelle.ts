import { skin } from "@repo/design-system/components/three/energy/skin";

/**
 * The housing on top of a wind turbine's tower: a glass-fibre shell with
 * rounded corners over the gearbox and generator, a little narrower where
 * it meets the hub, blunt and rounded at the back. Every measure is a share
 * of the rotor's radius.
 */

/** The nacelle's length, half its width and half its height, in rotor radii. */
export const NACELLE = { half: 0.05, length: 0.3, tall: 0.052 } as const;

/** How square the shell's sections are: 2 is an ellipse, more is boxier. */
const SQUARE = 5;

/** The share of the length over which the front face and the back round off. */
const FRONT = 0.06;
const BACK = 0.12;

/** A smooth rise from 0 to 1 while `share` goes from 0 to 1. */
function eased(share: number) {
  const held = Math.min(1, Math.max(0, share));
  return held * held * (3 - 2 * held);
}

/** A rounded shoulder: 1 while `share` is 0, falling to 0 as `share` reaches 1. */
function shoulder(share: number) {
  return (1 - Math.min(1, Math.max(0, share)) ** 4) ** 0.25;
}

/** How wide the shell is at a share `along` its length, from 0 at a closed end to 1 at its fullest. */
export function girthAt(along: number) {
  const neck = 0.8 + 0.2 * eased(along / 0.3);
  const tail = 1 - 0.14 * eased((along - 0.45) / 0.55);
  return (
    neck *
    tail *
    shoulder((FRONT - along) / FRONT) *
    shoulder((along - (1 - BACK)) / BACK)
  );
}

/** One coordinate of a rounded-square section: the cosine or sine of its angle, squared off. */
function squared(value: number) {
  return Math.sign(value) * Math.abs(value) ** (2 / SQUARE);
}

/**
 * A point of the shell for a rotor of radius 1: `along` from the front face,
 * which looks toward +z, to the back, and `round` the section. The shell's
 * axis is the z axis, with the front face at z = 0.
 */
export function nacellePoint(along: number, round: number) {
  const turn = -round * 2 * Math.PI;
  const girth = girthAt(along);
  return [
    NACELLE.half * girth * squared(Math.cos(turn)),
    NACELLE.tall * girth * squared(Math.sin(turn)),
    -along * NACELLE.length,
  ] as const;
}

/** How many bulkheads the shell is lofted over, and how many faces go round each. */
const BULKHEADS = 40;
const AROUND = 48;

/** The shell as a mesh for a rotor of radius 1. */
export function nacelleGeometry() {
  return skin(BULKHEADS, AROUND, nacellePoint);
}
