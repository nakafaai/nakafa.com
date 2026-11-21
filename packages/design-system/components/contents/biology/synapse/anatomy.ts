import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr, Order, Schema } from "effect";

/**
 * The anatomy of one cholinergic synapse, drawn at the scale of an electron
 * micrograph: one scene unit is 10 nm. Membranes, vesicles, the cleft,
 * organelles and proteins keep their measured sizes; molecules and ions are
 * drawn several times larger than they are, or they would not show.
 */

/** A point in the scene, in units of 10 nm. */
const PointSchema = Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]);
export type Point = typeof PointSchema.Type;

/** A synaptic vesicle: its middle, its radius, and whether it is docked at the active zone. */
const VesicleSchema = Schema.Struct({
  centre: PointSchema,
  docked: Schema.Boolean,
  radius: Schema.Finite,
});
export type Vesicle = typeof VesicleSchema.Type;

/** A lipid bilayer, about 5 nm thick (Alberts et al., Molecular Biology of the Cell 6e, Ch. 10). */
export const BILAYER = 0.5;

/**
 * The synaptic cleft, 30 nm across: within the 20 to 40 nm that separate the
 * membranes at chemical synapses (Purves et al., Neuroscience 6e, 2018,
 * Fig. 5.2 draws 20 nm).
 */
export const CLEFT = 3;

/**
 * The presynaptic bouton: a superellipsoid 640 nm wide and 520 nm tall whose
 * flat face lies on the cleft, narrowing above into its axon, 160 nm across.
 * Boutons of central synapses measure about half a micrometre to a
 * micrometre (Purves et al., Neuroscience 6e, 2018, Fig. 5.4).
 */
export const BOUTON = { axon: 8, half: 26, power: 3, radius: 32, top: 80 };

/** The bouton's middle height. */
const BOUTON_MIDDLE = CLEFT + BOUTON.half;

/**
 * The dendrite of the next neuron: a superelliptic shaft 760 nm wide and
 * 600 nm deep, its upper face lying on the cleft.
 */
export const DENDRITE = { half: 30, length: 80, power: 2.4, width: 38 };

/** The middle of the mitochondrion, high in the bouton and a little off its axis. */
const MITOCHONDRION_CENTRE: Point = [-4, 25, 0];

/**
 * The mitochondrion in the bouton: a capsule 390 nm long and 150 nm across,
 * cut open with the bouton, in the size range of presynaptic mitochondria.
 */
export const MITOCHONDRION = {
  centre: MITOCHONDRION_CENTRE,
  half: 12,
  radius: 7.5,
};

/**
 * A synaptic vesicle's radius: 41.6 ± 8.4 nm across by cryo-electron
 * microscopy (Takamori et al., Cell 127:831, 2006).
 */
export const VESICLE = { radius: 2.08, spread: 0.42 };

/** The radius of the postsynaptic density and of the receptor field it holds. */
export const DENSITY = 12;

/**
 * The nicotinic receptor: a ring of five subunits about 8 nm across and
 * 16 nm long through the membrane, its ligand-binding domain rising about
 * 6 nm into the cleft (Unwin, J Mol Biol 346:967, 2005; Proc AuPS 36:24P, 2005).
 */
export const RECEPTOR = { above: 0.65, below: 0.45, length: 1.6, radius: 0.4 };

/** Spacing of receptors in the postsynaptic membrane: packed nearly side by side. */
const RECEPTOR_SPACING = 1.12;

/** The microtubules of the dendrite, 25 nm across (Alberts et al., Molecular Biology of the Cell 6e, Ch. 16). */
export const MICROTUBULE = 1.25;

/** The outer radius of the bouton at height `y`, zero outside it. */
export function boutonRadius(y: number) {
  const lower = Math.abs((y - BOUTON_MIDDLE) / BOUTON.half);
  const body =
    lower >= 1
      ? 0
      : BOUTON.radius * (1 - lower ** BOUTON.power) ** (1 / BOUTON.power);
  const axon = y > BOUTON_MIDDLE && y <= BOUTON.top ? BOUTON.axon : 0;
  return (body ** 6 + axon ** 6) ** (1 / 6);
}

/** The height of the bouton's lower face at distance `reach` from its axis, within its radius. */
export function boutonFace(reach: number) {
  const share = Math.min(1, Math.abs(reach) / BOUTON.radius);
  return (
    BOUTON_MIDDLE -
    BOUTON.half * (1 - share ** BOUTON.power) ** (1 / BOUTON.power)
  );
}

/**
 * The bouton's outline from the middle of its face up its axon, as pairs of
 * radius and height: the face sampled by angle so its rounded rim stays
 * smooth, the upper half and the axon by height.
 */
export function boutonProfile(
  count: number
): readonly (readonly [number, number])[] {
  const lower = Arr.map(Arr.range(0, count), (step) => {
    const angle = (step / count) * (Math.PI / 2);
    const across = Math.cos(Math.PI / 2 - angle) ** (2 / BOUTON.power);
    const down = Math.sin(Math.PI / 2 - angle) ** (2 / BOUTON.power);
    return [
      BOUTON.radius * across,
      BOUTON_MIDDLE - BOUTON.half * down,
    ] as const;
  });
  const upper = Arr.map(Arr.range(1, count), (step) => {
    const y = BOUTON_MIDDLE + ((BOUTON.top - BOUTON_MIDDLE) * step) / count;
    return [boutonRadius(y), y] as const;
  });
  return Arr.appendAll(lower, upper);
}

/** The height of the dendrite's upper face at depth `z`, within its width. */
export function dendriteTop(z: number) {
  const share = Math.min(1, Math.abs(z) / DENDRITE.width);
  return (
    -DENDRITE.half +
    DENDRITE.half * (1 - share ** DENDRITE.power) ** (1 / DENDRITE.power)
  );
}

/**
 * The dendrite's cross-section from the top of the cut round its back to
 * the bottom of the cut, as pairs of depth and height.
 */
export function dendriteProfile(
  count: number
): readonly (readonly [number, number])[] {
  return Arr.map(Arr.range(0, count), (step) => {
    const angle = (step / count) * Math.PI;
    const sine = Math.sin(angle);
    const cosine = Math.cos(angle);
    return [
      -DENDRITE.width * sine ** (2 / DENDRITE.power),
      -DENDRITE.half +
        DENDRITE.half *
          Math.sign(cosine) *
          Math.abs(cosine) ** (2 / DENDRITE.power),
    ] as const;
  });
}

/** The distance from a point to the mitochondrion's axis segment. */
export function fromMitochondrion([x, y, z]: Point) {
  const [cx, cy, cz] = MITOCHONDRION.centre;
  const along = Math.max(
    -MITOCHONDRION.half,
    Math.min(MITOCHONDRION.half, x - cx)
  );
  return Math.hypot(x - cx - along, y - cy, z - cz);
}

/** Where along the active zone the two vesicles that fuse with each impulse are docked. */
const FUSING = [-2.2, 2.9] as const;

/** The docked vesicles, lined along the active zone just behind the cut, the fusing two in the middle. */
const DOCKED = [-6.6, ...FUSING, 7.4] as const;

/** How far behind the cut the docked vesicles, the channels and the dense projections stand. */
export const ROW = { channel: -1, docked: -2.55, projection: -3.7 };

/** The vesicles of the active zone: four docked on the membrane and a cluster behind them. */
export function vesicles(count: number): readonly Vesicle[] {
  const docked = Arr.map(
    DOCKED,
    (x): Vesicle => ({
      centre: [x, CLEFT + BILAYER + VESICLE.radius + 0.02, ROW.docked],
      docked: true,
      radius: VESICLE.radius,
    })
  );
  return Arr.reduce(Arr.range(0, 1999), docked, (placed, index) => {
    if (placed.length >= count) {
      return placed;
    }
    const radius = VESICLE.radius + VESICLE.spread * (hashUnit(index, 5) - 0.5);
    const candidate: Vesicle = {
      centre: [
        -17 + 34 * hashUnit(index, 1),
        8.2 + 6.4 * hashUnit(index, 2) ** 1.4,
        -radius - 0.35 - 19 * hashUnit(index, 3),
      ],
      docked: false,
      radius,
    };
    return fitsVesicle(candidate, placed)
      ? Arr.append(placed, candidate)
      : placed;
  });
}

/** Whether a vesicle lies inside the bouton, clear of the mitochondrion, and of every vesicle placed. */
export function fitsVesicle(vesicle: Vesicle, placed: readonly Vesicle[]) {
  const [x, y, z] = vesicle.centre;
  const inside =
    Math.hypot(x, z) + vesicle.radius + 0.4 <= boutonRadius(y) - BILAYER;
  const clear =
    fromMitochondrion(vesicle.centre) >=
    MITOCHONDRION.radius + vesicle.radius + 0.4;
  return (
    inside &&
    clear &&
    Arr.every(
      placed,
      (other) =>
        Math.hypot(
          x - other.centre[0],
          y - other.centre[1],
          z - other.centre[2]
        ) >=
        vesicle.radius + other.radius + 0.25
    )
  );
}

/** The voltage-gated Ca2+ channels of the active zone, as positions on the bouton's face. */
export const CHANNELS: readonly Point[] = Arr.map(
  [
    [-4.3, ROW.channel],
    [0.6, ROW.channel],
    [5.2, ROW.channel],
    [-1.9, -5.6],
    [3.9, -6.4],
    [-6.2, -7.4],
    [1.2, -9.6],
  ] as const,
  ([x, z]): Point => [x, boutonFace(Math.hypot(x, z)), z]
);

/** The dense projections of the active zone, standing on the inner face of the bouton's membrane. */
export const PROJECTIONS: readonly Point[] = Arr.map(
  [-4.3, 0.6, 5.2] as const,
  (x): Point => [
    x,
    boutonFace(Math.hypot(x, ROW.projection)) + BILAYER,
    ROW.projection,
  ]
);

/** The choline transporters, just outside the active zone where the bouton's face curves up. */
export const TRANSPORTERS: readonly Point[] = Arr.map(
  [
    [-13.6, -1.1],
    [13.8, -1.3],
    [-12.4, -7.2],
    [12.9, -6.1],
  ] as const,
  ([x, z]): Point => [x, boutonFace(Math.hypot(x, z)), z]
);

/**
 * Acetylcholinesterase: tetramers held on the postsynaptic membrane by their
 * anchor, scattered among the receptors and around them.
 */
export const ENZYMES: readonly Point[] = Arr.map(
  [
    [-8.6, -1.2],
    [2.6, -1.3],
    [9.6, -1.25],
    [-3.4, -8.4],
    [6.6, -8.9],
    [0.4, -12.6],
    [-11.2, -4.6],
    [11.4, -5.8],
    [-15.6, -2.4],
    [15.9, -2.2],
  ] as const,
  ([x, z]): Point => [x, dendriteTop(z), z]
);

/** How close a receptor may stand to an enzyme's anchor. */
const ENZYME_CLEARANCE = 1.15;

/**
 * The acetylcholine receptors of the postsynaptic density: rows packed
 * nearly side by side across a half disc behind the cut, each set a little
 * off its place, leaving room round every enzyme's anchor.
 */
export function receptors(): readonly Point[] {
  const rows = Math.floor(DENSITY / (RECEPTOR_SPACING * 0.866));
  return Arr.flatMap(Arr.range(0, rows), (row) => {
    const z = -RECEPTOR.radius - 0.15 - row * RECEPTOR_SPACING * 0.866;
    const reach = Math.sqrt(Math.max(0, DENSITY ** 2 - z ** 2));
    const shift = row % 2 === 0 ? 0 : RECEPTOR_SPACING / 2;
    const columns = Math.floor((2 * reach) / RECEPTOR_SPACING);
    const places = Arr.map(Arr.range(0, columns), (column): Point => {
      const x =
        -reach +
        shift +
        column * RECEPTOR_SPACING +
        0.08 * (hashUnit(row, column) - 0.5);
      return [x, dendriteTop(z), z];
    });
    return Arr.filter(
      places,
      ([x]) =>
        Math.abs(x) <= reach &&
        Arr.every(
          ENZYMES,
          ([ex, , ez]) => Math.hypot(x - ex, z - ez) >= ENZYME_CLEARANCE
        )
    );
  });
}

/** The dendrite's microtubules, as their depth and height; they run its whole length. */
export const MICROTUBULES: readonly (readonly [number, number])[] = [
  [-6.5, -11.5],
  [-15.5, -17],
  [-24, -12.5],
  [-9.5, -24.5],
  [-20, -28],
];

/** Where the two fusing vesicles open into the cleft, on the bouton's face below them. */
export const RELEASE: readonly Point[] = Arr.map(
  FUSING,
  (x): Point => [x, boutonFace(Math.hypot(x, ROW.docked)), ROW.docked]
);

/** How far a point of the postsynaptic membrane lies from the nearer release site, across the cleft's plane. */
function fromRelease([x, , z]: Point) {
  return Math.min(
    ...Arr.map(RELEASE, ([rx, , rz]) => Math.hypot(x - rx, z - rz))
  );
}

/** The `count` receptors nearest the release sites, nearest first: the ones the lab shows binding and opening. */
export function nearest(places: readonly Point[], count: number) {
  return Arr.take(
    Arr.sort(places, Order.mapInput(Order.Number, fromRelease)),
    count
  );
}

/** Vesicles the bouton holds at its active zone, the docked ones among them. */
export const CLUSTER = vesicles(40);

/** Every receptor of the density, in the order it is placed. */
const RECEPTORS = receptors();

/** The receptor field, nearest the release sites first, so the lab can show the nearest binding. */
export const FIELD = nearest(RECEPTORS, RECEPTORS.length);
