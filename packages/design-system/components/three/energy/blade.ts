import { skin } from "@repo/design-system/components/three/energy/skin";

/**
 * One blade of a utility wind turbine, as its maker lofts it: a round root
 * that bolts to the pitch bearing, swelling into the widest aerofoil a fifth
 * of the way out, then tapering and untwisting to a thin rounded tip. Every
 * measure is a share of the blade's length, so one blade serves a rotor of
 * any size.
 */

/** Where along the span the blade is widest. */
const SHOULDER = 0.22;

/** The root's diameter, the widest chord and the chord near the tip, in blade lengths. */
const ROOT_CHORD = 0.05;
const WIDEST_CHORD = 0.092;
const TIP_CHORD = 0.022;

/** Where the tip starts rounding off. */
const TIP_START = 0.965;

/** The thickness of the aerofoil at the shoulder and at the tip, in chords. */
const SHOULDER_THICKNESS = 0.3;
const TIP_THICKNESS = 0.16;

/** How far the shoulder is twisted into the wind, and the pitch the tip keeps, in radians. */
const TWIST = 0.3;
const PITCH = 0.04;

/** Where along the chord the pitch axis runs, from the leading edge. */
const AXIS = 0.3;

/** How far the tip is bent upwind so a loaded blade clears the tower, in blade lengths. */
const PREBEND = 0.035;

/** How strongly the aerofoil is cambered, in chords. */
const CAMBER = 0.035;

/** A smooth rise from 0 to 1 while `share` goes from 0 to 1. */
function eased(share: number) {
  const held = Math.min(1, Math.max(0, share));
  return held * held * (3 - 2 * held);
}

/** How round the section is at a share `along` the span: 1 at the root's circle, 0 from the shoulder out. */
export function roundAt(along: number) {
  return 1 - eased(along / SHOULDER);
}

/** The blade's chord at a share `along` its span, in blade lengths. */
export function chordAt(along: number) {
  const inboard =
    ROOT_CHORD + (WIDEST_CHORD - ROOT_CHORD) * eased(along / SHOULDER);
  const outboard =
    WIDEST_CHORD +
    (TIP_CHORD - WIDEST_CHORD) *
      (Math.max(0, along - SHOULDER) / (1 - SHOULDER)) ** 0.85;
  const rounding = Math.max(0, along - TIP_START) / (1 - TIP_START);
  return Math.min(inboard, outboard) * Math.sqrt(1 - rounding * rounding);
}

/** How far the section is turned into the wind at a share `along` the span, in radians. */
export function twistAt(along: number) {
  return PITCH + TWIST * (1 - along) ** 2;
}

/** Half the aerofoil's thickness at a share `across` its chord, in chords: the NACA four-digit form with a closed trailing edge. */
function halfThickness(across: number, thickness: number) {
  return (
    5 *
    thickness *
    (0.2969 * Math.sqrt(across) -
      0.126 * across -
      0.3516 * across ** 2 +
      0.2843 * across ** 3 -
      0.1036 * across ** 4)
  );
}

/**
 * A point of the blade's skin, for a blade one unit long that stands along
 * +y with the wind arriving along -z: `along` the span from root to tip and
 * `round` the section from the trailing edge, over the downwind face, round
 * the leading edge and back along the upwind face. The leading edge looks
 * toward +x, the way a rotor turning clockwise from upwind moves.
 */
export function bladePoint(along: number, round: number) {
  const turn = round * 2 * Math.PI;
  const circular = roundAt(along);
  const chord = chordAt(along);
  const across = 0.5 * (1 + Math.cos(turn));
  const side = Math.sin(turn);
  const thickness =
    SHOULDER_THICKNESS +
    (TIP_THICKNESS - SHOULDER_THICKNESS) *
      (Math.max(0, along - SHOULDER) / (1 - SHOULDER));
  const foilX = AXIS - across;
  const foilZ = -(
    4 * CAMBER * across * (1 - across) +
    Math.sign(side) * halfThickness(across, thickness)
  );
  const x = (foilX + (0.5 - across - foilX) * circular) * chord;
  const z = (foilZ + (-0.5 * side - foilZ) * circular) * chord;
  const twist = twistAt(along);
  return [
    x * Math.cos(twist) - z * Math.sin(twist),
    along,
    x * Math.sin(twist) + z * Math.cos(twist) + PREBEND * along * along,
  ] as const;
}

/** How many sections the blade is lofted over, and how many faces go round each. */
const SECTIONS = 56;
const AROUND = 40;

/**
 * The blade as a mesh `length` scene units long, its root at the origin and
 * its tip along +y.
 */
export function bladeGeometry(length: number) {
  return skin(SECTIONS, AROUND, (along, round) => {
    const [x, y, z] = bladePoint(along, 1 - round);
    return [x * length, y * length, z * length];
  });
}
