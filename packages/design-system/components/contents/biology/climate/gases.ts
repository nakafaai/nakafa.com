import {
  hidden,
  infraredRays,
  onScreen,
  rayClearance,
} from "@repo/design-system/components/contents/biology/climate/rays";
import { Array as Arr, Schema } from "effect";
import { Euler, Line3, Vector3 } from "three";

/** The elements the three greenhouse gases are built from. */
const ElementSchema = Schema.Literals(["carbon", "hydrogen", "oxygen"]);
type Element = typeof ElementSchema.Type;

/** The greenhouse gases the atmosphere of the lab holds. */
const GasSchema = Schema.Literals(["carbonDioxide", "water", "methane"]);
type Gas = typeof GasSchema.Type;

/** Scene units for one ångström, so a molecule reads beside the Earth. */
const ANGSTROM = 0.075;

/**
 * The radius each atom is drawn with in the ball-and-stick model, in
 * ångströms, about a quarter of its van der Waals radius, so the sticks
 * between the balls show.
 */
const BALL = { carbon: 0.42, hydrogen: 0.28, oxygen: 0.4 } as const;

/** The radius of a single bond's stick, and of each stick of a double one. */
const STICK = { double: 0.085, single: 0.12 } as const;

/** How far apart the two sticks of a double bond stand, in ångströms. */
const DOUBLE_GAP = 0.3;

/** A tetrahedral C-H direction: the corners of a cube that share no edge. */
const corner = (x: number, y: number, z: number) =>
  [
    (x * 1.087) / Math.sqrt(3),
    (y * 1.087) / Math.sqrt(3),
    (z * 1.087) / Math.sqrt(3),
  ] as const;

/**
 * How far apart water's hydrogens stand from its middle, and how far its
 * oxygen stands above them, from O-H 0.958 Å at an angle of 104.5 degrees.
 */
const WATER_HALF_ANGLE = (104.5 / 2) * (Math.PI / 180);
const WATER_SPREAD = 0.958 * Math.sin(WATER_HALF_ANGLE);
const WATER_RISE = 0.958 * Math.cos(WATER_HALF_ANGLE);

/** One atom of a model: its element and where it sits, in ångströms. */
const AtomSchema = Schema.Struct({
  at: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
  element: ElementSchema,
});

/** A molecule as a central atom bonded by bonds of one order to the rest. */
const ModelSchema = Schema.Struct({
  center: AtomSchema,
  order: Schema.Literals([1, 2]),
  outer: Schema.Array(AtomSchema),
});

/**
 * Each gas as a central atom bonded to its outer atoms, in its own frame in
 * ångströms, from measured gas-phase geometry: carbon dioxide is linear with
 * double C=O bonds of 1.16 Å, water bent at 104.5° with O-H 0.958 Å, and
 * methane a tetrahedron with C-H 1.087 Å. Water is centred on the middle of
 * the molecule rather than on its oxygen.
 */
const MODELS: Record<Gas, typeof ModelSchema.Type> = {
  carbonDioxide: {
    center: { at: [0, 0, 0], element: "carbon" },
    order: 2,
    outer: [
      { at: [1.16, 0, 0], element: "oxygen" },
      { at: [-1.16, 0, 0], element: "oxygen" },
    ],
  },
  methane: {
    center: { at: [0, 0, 0], element: "carbon" },
    order: 1,
    outer: [
      { at: corner(1, 1, 1), element: "hydrogen" },
      { at: corner(1, -1, -1), element: "hydrogen" },
      { at: corner(-1, 1, -1), element: "hydrogen" },
      { at: corner(-1, -1, 1), element: "hydrogen" },
    ],
  },
  water: {
    center: { at: [0, WATER_RISE / 2, 0], element: "oxygen" },
    order: 1,
    outer: [
      { at: [WATER_SPREAD, -WATER_RISE / 2, 0], element: "hydrogen" },
      { at: [-WATER_SPREAD, -WATER_RISE / 2, 0], element: "hydrogen" },
    ],
  },
};

/**
 * The mix of molecules that fill the atmosphere in turn: water vapour, the
 * most plentiful greenhouse gas, then carbon dioxide, then a little methane.
 */
const MIX: readonly Gas[] = [
  "water",
  "carbonDioxide",
  "water",
  "carbonDioxide",
  "methane",
];

/** The gases that stop the rays, in the order they stop them. */
const ABSORBERS: readonly Gas[] = ["carbonDioxide", "water", "methane"];

/** The free molecules at gas level 1, and how many each level adds. */
const BASE_COUNT = 6;
const LEVEL_COUNT = 5;

/**
 * Candidate places for a free molecule, which stand at three heights in turn
 * from the lowest, a step apart.
 */
const CANDIDATES = 96;
const LOWEST = 1.1;
const HEIGHT_STEP = 0.1;

/** A step coprime with the candidates, which spreads them over the globe. */
const STRIDE = 37;

/**
 * How far a molecule keeps from any infrared ray, from a sunbeam, which it
 * must not seem to catch, and from a stopping molecule.
 */
const RAY_CLEARANCE = 0.19;
const BEAM_CLEARANCE = 0.32;

/** How far apart two free molecules stand, as the camera sees them. */
const SPACING = 0.26;
const ABSORBER_CLEARANCE = 0.3;

const GOLDEN = (Math.sqrt(5) - 1) / 2;

const vector = (point: readonly [number, number, number]) =>
  new Vector3(point[0], point[1], point[2]);

const triple = (point: Vector3) => [point.x, point.y, point.z] as const;

/** A tumble for molecule `seed`, spread evenly by golden-ratio steps. */
function tumble(seed: number) {
  const turn = (step: number) => ((seed * step) % 1) * Math.PI * 2;
  return new Euler(turn(GOLDEN), turn(Math.SQRT2 - 1), turn(Math.sqrt(3) - 1));
}

/** Candidate `index` on a Fibonacci sphere, at one of three heights. */
function candidate(index: number) {
  const y = 1 - ((index + 0.5) / CANDIDATES) * 2;
  const ring = Math.sqrt(1 - y * y);
  const angle = index * Math.PI * (3 - Math.sqrt(5));
  const height = LOWEST + HEIGHT_STEP * (index % 3);
  return new Vector3(
    Math.cos(angle) * ring,
    y,
    Math.sin(angle) * ring
  ).multiplyScalar(height);
}

/**
 * The free molecules' places, in the order they appear as the gas level
 * rises, clear of every ray and stopping molecule at every level and apart
 * from each other, so a molecule never moves when the level changes. Every
 * distance is measured as the camera sees it, so no molecule seems to sit on
 * a ray or another molecule that in fact passes in front of it or behind it;
 * a molecule the Earth hides keeps clear of nothing.
 */
function freePlaces() {
  const { absorbers, beams, segments } = rayClearance();
  const near = new Vector3();
  const seen = (place: Vector3) => vector(onScreen(triple(place)));
  const keepsFrom =
    (stretches: typeof segments, clearance: number) => (place: Vector3) =>
      Arr.every(
        stretches,
        (stretch) =>
          new Line3(
            vector(onScreen(stretch.start)),
            vector(onScreen(stretch.end))
          )
            .closestPointToPoint(seen(place), true, near)
            .distanceTo(seen(place)) >= clearance
      );
  const apart =
    (others: readonly Vector3[], clearance: number) => (place: Vector3) =>
      Arr.every(
        others,
        (other) => seen(other).distanceTo(seen(place)) >= clearance
      );
  const clearOfRays = keepsFrom(segments, RAY_CLEARANCE);
  const clearOfBeams = keepsFrom(beams, BEAM_CLEARANCE);
  const clearOfAbsorbers = apart(
    Arr.map(absorbers, vector),
    ABSORBER_CLEARANCE
  );
  return Arr.reduce(
    Arr.map(Arr.range(0, CANDIDATES - 1), (step) =>
      candidate((step * STRIDE) % CANDIDATES)
    ),
    Arr.empty<Vector3>(),
    (kept, place) => {
      const shown = Arr.filter(kept, (other) => !hidden(triple(other)));
      const fits =
        hidden(triple(place)) ||
        (clearOfRays(place) &&
          clearOfBeams(place) &&
          clearOfAbsorbers(place) &&
          apart(shown, SPACING)(place));
      return fits ? Arr.append(kept, place) : kept;
    }
  );
}

/** The first `count` gases of `gases` repeated over and over. */
const cycle = (gases: readonly Gas[], count: number) =>
  Arr.take(Arr.flatten(Arr.replicate(gases, count)), count);

/**
 * The molecules of the atmosphere at gas level `level`, from 1 to 5: one
 * at each ray it stops, and free molecules that grow in number with it.
 */
function atmosphere(level: number) {
  const stopping = Arr.getSomes(
    Arr.map(infraredRays(level), (ray) => ray.absorber)
  );
  const free = Arr.take(freePlaces(), BASE_COUNT + LEVEL_COUNT * (level - 1));
  return Arr.appendAll(
    Arr.map(
      Arr.zip(stopping, cycle(ABSORBERS, stopping.length)),
      ([center, gas], index) => ({ center, gas, seed: index + 0.5 })
    ),
    Arr.map(Arr.zip(free, cycle(MIX, free.length)), ([place, gas], index) => ({
      center: triple(place),
      gas,
      seed: index + 7.5,
    }))
  );
}

/** One half of a bond's stick, from an atom to the bond's middle. */
function halfStick(
  element: Element,
  from: Vector3,
  middle: Vector3,
  radius: number
) {
  const run = middle.clone().sub(from);
  return {
    element,
    position: triple(from.clone().addScaledVector(run, 0.5)),
    scale: [radius, run.length(), radius] as const,
    up: triple(run),
  };
}

/** The balls and half-sticks of one molecule, placed in the scene. */
function build(molecule: ReturnType<typeof atmosphere>[number]) {
  const model = MODELS[molecule.gas];
  const turn = tumble(molecule.seed);
  const center = vector(molecule.center);
  const place = (at: Vector3) =>
    at.clone().applyEuler(turn).multiplyScalar(ANGSTROM).add(center);
  const offsets = model.order === 2 ? [-DOUBLE_GAP / 2, DOUBLE_GAP / 2] : [0];
  const radius = (model.order === 2 ? STICK.double : STICK.single) * ANGSTROM;
  const sticks = Arr.flatMap(model.outer, (atom) => {
    const run = vector(atom.at).sub(vector(model.center.at));
    // A double bond's two sticks lie side by side in the molecule's plane.
    const aside = run.cross(new Vector3(0, 0, 1)).normalize();
    return Arr.flatMap(offsets, (offset) => {
      const a = place(vector(model.center.at).addScaledVector(aside, offset));
      const b = place(vector(atom.at).addScaledVector(aside, offset));
      const middle = a.clone().lerp(b, 0.5);
      return [
        halfStick(model.center.element, a, middle, radius),
        halfStick(atom.element, b, middle, radius),
      ];
    });
  });
  const balls = Arr.map(Arr.prepend(model.outer, model.center), (atom) => ({
    element: atom.element,
    position: triple(place(vector(atom.at))),
    radius: BALL[atom.element] * ANGSTROM,
  }));
  return { balls, sticks };
}

/**
 * Every ball and stick of the molecules at gas level `level`, by element, so
 * each element is drawn as one instanced ball and one instanced stick. A
 * bond is two half-sticks, each coloured as its own atom.
 */
export function moleculeParts(level: number) {
  const molecules = Arr.map(atmosphere(level), build);
  const balls = Arr.flatMap(molecules, (molecule) => molecule.balls);
  const sticks = Arr.flatMap(molecules, (molecule) => molecule.sticks);
  const of = (element: Element) => ({
    balls: Arr.map(
      Arr.filter(balls, (ball) => ball.element === element),
      (ball) => ({
        position: ball.position,
        scale: [ball.radius, ball.radius, ball.radius] as const,
      })
    ),
    sticks: Arr.filter(sticks, (stick) => stick.element === element),
  });
  return {
    carbon: of("carbon"),
    hydrogen: of("hydrogen"),
    oxygen: of("oxygen"),
  };
}
