import type { Particle } from "@repo/design-system/components/contents/chemistry/equation/layout";
import type { Point } from "@repo/design-system/components/contents/chemistry/molecule/geometry";
import { Schema } from "effect";

/** How long one run of a reaction lasts while the card plays, in seconds. */
export const REACTION_SECONDS = 7;

/** How high an atom lifts out of the plane halfway along its path. */
const LIFT = 0.9;

/** Where one stage of the reaction starts and ends, as shares of its run. */
const StageSchema = Schema.Struct({ end: Schema.Finite, start: Schema.Finite });

/** Where the reaction's three stages start and end. */
const BREAK = { end: 0.32, start: 0.12 } as const;
const TRAVEL = { end: 0.78, start: 0.28 } as const;
const FORM = { end: 0.9, start: 0.72 } as const;

/** How far `progress` has gone through the stage from `start` to `end`, 0 to 1. */
function through(progress: number, stage: typeof StageSchema.Type) {
  const share = (progress - stage.start) / (stage.end - stage.start);
  return Math.min(1, Math.max(0, share));
}

/** Eases a share in and out, as a body that speeds up and slows down does. */
function smooth(share: number) {
  return share * share * (3 - 2 * share);
}

/**
 * How thick the reactant and the product bonds stand at `progress`, 0 to 1:
 * the old bonds thin away first, and the new ones grow once the atoms arrive.
 */
export function bondStrengths(progress: number) {
  return {
    products: smooth(through(progress, FORM)),
    reactants: 1 - smooth(through(progress, BREAK)),
  };
}

/**
 * Where one atom stands at `progress`: in its reactant until the old bonds
 * break, then along an arc that lifts it toward the camera, so atoms that
 * cross do not pass through each other, and into its product.
 */
export function particlePosition(particle: Particle, progress: number): Point {
  const share = smooth(through(progress, TRAVEL));
  // A parabola lifts the atom, flat at both ends of its path.
  const lift = 4 * LIFT * share * (1 - share);
  return [
    particle.start[0] + (particle.end[0] - particle.start[0]) * share,
    particle.start[1] + (particle.end[1] - particle.start[1]) * share,
    particle.start[2] + (particle.end[2] - particle.start[2]) * share + lift,
  ];
}

/** Moves a playing run on by `seconds`, starting over after a pause at the end. */
export function advanceProgress(progress: number, seconds: number) {
  const next = progress + seconds / REACTION_SECONDS;
  return next > 1.15 ? 0 : next;
}
