import { Array as Arr, Schema } from "effect";

/** The particles a track lab fires into the field. */
export const ParticleIdSchema = Schema.Literals([
  "electron",
  "proton",
  "neutron",
]);
export type ParticleId = typeof ParticleIdSchema.Type;

/** A particle's mass in kilograms and charge in elementary charges. */
const ParticleSchema = Schema.Struct({
  charge: Schema.Int,
  mass: Schema.Finite,
});

/** Masses in kilograms and charges in elementary charges (CODATA 2018). */
const PARTICLES = {
  electron: { charge: -1, mass: 9.109_383_7e-31 },
  neutron: { charge: 0, mass: 1.674_927_5e-27 },
  proton: { charge: 1, mass: 1.672_621_9e-27 },
} as const satisfies Record<ParticleId, typeof ParticleSchema.Type>;

/** The elementary charge in coulombs. */
const CHARGE = 1.602_176_634e-19;

/** The speed every particle enters the field with, in metres a second. */
const SPEED = 1e6;

/** The mass and charge of a particle. */
export function getParticle(id: ParticleId) {
  return PARTICLES[id];
}

/**
 * The radius a charged particle circles on in a magnetic field `field`
 * tesla, r = m v / (|q| B), in metres; a neutral particle flies straight.
 */
export function trackRadius(id: ParticleId, field: number) {
  const { charge, mass } = PARTICLES[id];
  return charge === 0
    ? Number.POSITIVE_INFINITY
    : (mass * SPEED) / (Math.abs(charge) * CHARGE * field);
}

/**
 * The track as points (x, y) in metres, entering at the origin along +x,
 * turned by the field into the page: a positive particle curves toward +y
 * and a negative one toward -y. It stops at `length` metres of path or once
 * it leaves the square of half width `limit`.
 */
export function trackPoints(
  id: ParticleId,
  field: number,
  length: number,
  limit: number,
  samples: number
) {
  const { charge } = PARTICLES[id];
  const radius = trackRadius(id, field);
  return Arr.flatMap(Arr.range(0, samples), (step) => {
    const travelled = (length * step) / samples;
    const point =
      charge === 0
        ? ([travelled, 0] as const)
        : ([
            radius * Math.sin(travelled / radius),
            Math.sign(charge) * radius * (1 - Math.cos(travelled / radius)),
          ] as const);
    return Math.abs(point[0]) <= limit && Math.abs(point[1]) <= limit
      ? [point]
      : [];
  });
}
