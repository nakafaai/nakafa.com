import { Array as Arr, Schema } from "effect";

/**
 * The orbitals of the hydrogen atom an orbital lab can draw. Each is a real
 * orbital: a radial part times a real angular part, so its lobes have one sign
 * or the other, as chemistry books draw them.
 */
export const OrbitalIdSchema = Schema.Literals([
  "1s",
  "2s",
  "2px",
  "2pz",
  "3s",
  "3pz",
  "3dz2",
  "3dxy",
]);
export type OrbitalId = typeof OrbitalIdSchema.Type;

/** The quantum numbers of one orbital and its name in TeX. */
const OrbitalSchema = Schema.Struct({
  l: Schema.Int,
  n: Schema.Literals([1, 2, 3]),
  tex: Schema.String,
});

/** Every orbital's quantum numbers and name. */
const ORBITALS = {
  "1s": { l: 0, n: 1, tex: "1s" },
  "2px": { l: 1, n: 2, tex: "2p_x" },
  "2pz": { l: 1, n: 2, tex: "2p_z" },
  "2s": { l: 0, n: 2, tex: "2s" },
  "3dxy": { l: 2, n: 3, tex: "3d_{xy}" },
  "3dz2": { l: 2, n: 3, tex: "3d_{z^2}" },
  "3pz": { l: 1, n: 3, tex: "3p_z" },
  "3s": { l: 0, n: 3, tex: "3s" },
} as const satisfies Record<OrbitalId, typeof OrbitalSchema.Type>;

/** The principal and angular quantum numbers and the TeX name of an orbital. */
export function orbitalNumbers(id: OrbitalId) {
  return ORBITALS[id];
}

/** The radial nodes of an orbital, spheres where it vanishes: n - l - 1. */
export function radialNodes(id: OrbitalId) {
  const { l, n } = ORBITALS[id];
  return n - l - 1;
}

/**
 * The radial part R(r) of hydrogen's wave function, with r in Bohr radii
 * (Griffiths, Introduction to Quantum Mechanics, table 4.7). Normalising
 * factors are left out: only the shape and the sign matter for the cloud.
 */
function radial(id: OrbitalId, r: number) {
  const radials = {
    "1s": Math.exp(-r),
    "2px": r * Math.exp(-r / 2),
    "2pz": r * Math.exp(-r / 2),
    "2s": (2 - r) * Math.exp(-r / 2),
    "3dxy": r * r * Math.exp(-r / 3),
    "3dz2": r * r * Math.exp(-r / 3),
    "3pz": (6 - r) * r * Math.exp(-r / 3),
    "3s": (27 - 18 * r + 2 * r * r) * Math.exp(-r / 3),
  } as const satisfies Record<OrbitalId, number>;
  return radials[id];
}

/** The real angular part of an orbital at the direction (x, y, z) / r. */
function angular(id: OrbitalId, x: number, y: number, z: number, r: number) {
  if (r === 0) {
    return ORBITALS[id].l === 0 ? 1 : 0;
  }
  const angulars = {
    "1s": 1,
    "2px": x / r,
    "2pz": z / r,
    "2s": 1,
    "3dxy": (x * y) / (r * r),
    "3dz2": (3 * z * z - r * r) / (r * r),
    "3pz": z / r,
    "3s": 1,
  } as const satisfies Record<OrbitalId, number>;
  return angulars[id];
}

/** The wave function of one orbital at a point, in Bohr radii, without its norm. */
export function waveAt(id: OrbitalId, x: number, y: number, z: number) {
  const r = Math.sqrt(x * x + y * y + z * z);
  return radial(id, r) * angular(id, x, y, z, r);
}

/** How far the cloud of each shell reaches, in Bohr radii: 90% of it lies within. */
const SHELL_REACH = { 1: 3, 2: 9, 3: 17 } as const;

/** The half width of the cube an orbital's cloud is drawn from, in Bohr radii. */
export function orbitalReach(id: OrbitalId) {
  return SHELL_REACH[ORBITALS[id].n];
}

/**
 * The radical inverse of `index` in base `base`, the coordinate of a Halton
 * sequence: points that fill a cube evenly with no random generator, so a
 * cloud is the same on every load and every device.
 */
export function halton(index: number, base: number) {
  let result = 0;
  let fraction = 1 / base;
  let rest = index;
  while (rest > 0) {
    result += fraction * (rest % base);
    rest = Math.floor(rest / base);
    fraction /= base;
  }
  return result;
}

/** One sampled point of a cloud and the sign of the wave function there. */
const CloudPointSchema = Schema.Struct({
  phase: Schema.Literals([-1, 1]),
  position: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
});
type CloudPoint = typeof CloudPointSchema.Type;

/**
 * Samples an orbital's probability cloud, |psi|^2, by rejection from evenly
 * spread candidates: a candidate is kept with the chance its density bears to
 * the densest candidate, so the kept points crowd where the electron is most
 * likely to be found. `candidates` sets the effort; about one in ten survives
 * for an s orbital and fewer for a spread-out d orbital.
 */
export function sampleCloud(id: OrbitalId, candidates: number) {
  const reach = orbitalReach(id);
  const drawn = Arr.makeBy(candidates, (index) => {
    const x = (2 * halton(index + 1, 2) - 1) * reach;
    const y = (2 * halton(index + 1, 3) - 1) * reach;
    const z = (2 * halton(index + 1, 5) - 1) * reach;
    const wave = waveAt(id, x, y, z);
    return { accept: halton(index + 1, 7), position: [x, y, z] as const, wave };
  });
  const densest = Arr.reduce(drawn, 0, (most, point) =>
    Math.max(most, point.wave * point.wave)
  );
  return Arr.flatMap(drawn, (point): readonly CloudPoint[] =>
    point.accept * densest < point.wave * point.wave
      ? [{ phase: point.wave < 0 ? -1 : 1, position: point.position }]
      : []
  );
}
